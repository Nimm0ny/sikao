# Phase-Practice · 02 · Data Model

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Convention**: Python type hints; SQLAlchemy 2.0 declarative；Alembic migration 字段顺序与本文件 §3-§4 一致
> **重要**：所有"`db/models/*.py`"路径均为**逻辑命名**，实际文件 = `services/api/src/sikao_api/db/models_v2.py`（详见 [A0 §2.1](./A0-Codebase-Reality-Check.md#21-dbmodels-是单文件)）

---

## 1. ER 总览

```
QuestionV2 (扩展) ──┐
                    ├─ source / year / region / exam_type
                    ├─ category_l1 / category_l2
                    ├─ historical_accuracy / answer_count
                    ├─ quality_score / report_count / is_active     (AI 题专属)
                    ├─ ai_source_question_id (self-ref nullable)
                    ├─ ai_self_audit_passed / ai_generated_at        (AI 题专属)
                    ├─ content_hash (UNIQUE)                         (去重)
                    └─ [Phase-1 Question-Metadata 预留字段]
                       ability_dimensions / discrimination_index /
                       heat_score / complexity_level / knowledge_tags
                    │
                    ↓
  ┌─────────────────────────────────────────────────────┐
  │ QuestionFavoriteV2 (NEW)  ─ user-question 收藏关系    │
  │ QuestionFlagV2 (NEW)      ─ user-question 持久标记     │
  │ QuestionTimingBaselineV2 (NEW) ─ 每题 p50/p90/p95     │
  │ QuestionKnowledgePointV2 (NEW, schema-only Phase 1)  │
  └─────────────────────────────────────────────────────┘

KnowledgePointV2 (NEW, schema-only Phase 1)
  ─ code / label / category_l1/l2 / parent_id / weight_in_exam

PracticeSessionV2 (扩展)──┐
                          ├─ practice_mode (per_question | full_set)
                          ├─ source_mode (paper|category|custom|ai_generated|daily|wrong_redo)
                          ├─ config_snapshot (JSON)
                          ├─ [session_lifecycle 字段]
                          │   status (draft|in_progress|paused|submitted|abandoned|expired)
                          │   paused_at / paused_count / last_heartbeat_at
                          │   expires_at / abandoned_at / abandoned_reason
                          │   force_submitted / force_submitted_reason
                          │   recovered_from_session_id (self-ref)
                          ├─ [timing 字段]
                          │   total_active_seconds / paused_total_seconds
                          │   first_question_at / last_activity_at
                          └─ [mock_exam 字段]
                              exam_mode / time_limit_minutes
                              auto_submit_at (immutable)
                              allow_review_during / allow_pause
                              delayed_review_until

PracticeSessionAnswerV2 (扩展)──┐
                                ├─ flagged                (本次 session 内)
                                ├─ viewed_solution / view_solution_at  (逐题模式)
                                └─ [timing 字段]
                                    time_spent_ms / first_seen_at
                                    first_answered_at / last_modified_at
                                    answer_change_count / visit_count
                                    is_overtime

NoteV2 (扩展) ──┬─ linked_question_id (FK QuestionV2 nullable)
               └─ visibility (private)

ReviewItemV2 (扩展) ─ reason 枚举加 flagged_persistent

PracticeStatsSnapshotV2 (NEW) ─ 用户 × scope × type 聚合快照
                                ├─ overall / category_l1 / category_l2 三种 scope
                                └─ percentile_rank (周更新)

UserPracticePreferencesV2 (NEW) ─ user PK + payload(JSON) + schema_version

EssayReferenceAnswerV2 (NEW) ──┐
                                ├─ source (official|ai_generated|user_contributed)
                                ├─ likes_count / favorites_count / report_count / quality_score
                                └─ status (draft|public|archived)
                                ↓
EssayReferenceFeedbackV2 (NEW) ─ user-reference 反馈关系

AiGeneratedQuestionRequestV2 (NEW) ─ 审计 / 限流 / 失败追踪

DailyPracticeV2 (NEW) ─ 每日一练（user × date × type）
```

---

## 2. 现有表扩展（§2.1 - §2.5）

### 2.1 QuestionV2（最重要的扩展）

```python
class QuestionV2(Base):
    __tablename__ = "question_v2"

    # 现有字段保留
    id: Mapped[int] = mapped_column(primary_key=True)
    paper_id, paper_revision_id, section_id, block_id  # FK 套卷结构（保留）
    question_key: Mapped[str]                           # 唯一 key（保留）
    type: Mapped[QuestionType]                          # single_choice / multi_choice / essay 等
    stem: Mapped[str]
    options: Mapped[dict] = mapped_column(JSON)
    correct_answer: Mapped[str]
    explanation: Mapped[str]
    metadata: Mapped[dict] = mapped_column(JSON, default=dict)  # 保留扩展点

    # ===== Tab 2 新增字段 =====
    source: Mapped[QuestionSource]                      # real_exam | ai_generated | ai_modified
    year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    region: Mapped[str | None] = mapped_column(String(32), nullable=True)
    exam_type: Mapped[ExamType]                         # national | provincial | institution | xuandiao | other
    category_l1: Mapped[str] = mapped_column(String(32), index=True)  # 一级分类 key
    category_l2: Mapped[str | None] = mapped_column(String(64), index=True)  # 二级分类 key

    # 质量与统计
    historical_accuracy: Mapped[float] = mapped_column(Float, default=0.0)  # 0.0-1.0
    answer_count: Mapped[int] = mapped_column(Integer, default=0)
    quality_score: Mapped[float] = mapped_column(Float, default=5.0)  # 仅 AI 题有效，0.0-5.0
    report_count: Mapped[int] = mapped_column(Integer, default=0)     # 仅 AI 题有效
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    # 去重（用于 AI 题改编后命中已有题；真题导入时也用同一字段防重复入库）
    content_hash: Mapped[str | None] = mapped_column(String(32), unique=True, index=True, nullable=True)
    # 计算公式见 07-AI-Question-Engine §4.1：BLAKE2b(stem + 排序后 options + correct_answer)

    # AI 题专属
    ai_source_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("question_v2.id"), nullable=True
    )  # 改编自哪道真题
    ai_self_audit_passed: Mapped[bool | None]
    ai_generated_at: Mapped[datetime | None]

    # ===== Phase-1 Question-Metadata 预留字段（详见 15-Question-Metadata.md） =====
    # 仅建字段 + 默认值；端点 / cron / LLM 标注全部推到 Phase 2
    ability_dimensions: Mapped[list[str]] = mapped_column(JSON, default=list)
    # 能力维度数组：comprehension / reasoning / calculation / memory / application
    discrimination_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    # 区分度（0.0-1.0）；样本不足 = NULL
    heat_score: Mapped[float] = mapped_column(Float, default=0.0)
    # 热度分（最近 30d 答题次数 / type 平均次数）
    complexity_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    # 复杂度等级（1-5）；NULL = 未标注
    knowledge_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    # 字符串标签数组（snake_case），与 KnowledgePointV2 的结构化关联双轨

    __table_args__ = (
        Index("ix_question_v2_category", "category_l1", "category_l2"),
        Index("ix_question_v2_source_active", "source", "is_active"),
        Index("ix_question_v2_year_region_exam", "year", "region", "exam_type"),
        Index("ix_question_v2_heat", "heat_score"),
        # content_hash UNIQUE 已通过 unique=True 在字段上声明
        # PR2: source 字段 immutable trigger（详见 §5.1）
    )
```

**枚举定义**：

```python
class QuestionSource(StrEnum):
    REAL_EXAM = "real_exam"
    AI_GENERATED = "ai_generated"
    AI_MODIFIED = "ai_modified"   # 预留：未来可能区分"轻改编"vs"重写"

class ExamType(StrEnum):
    NATIONAL = "national"          # 国考
    PROVINCIAL = "provincial"      # 省考
    INSTITUTION = "institution"    # 事业单位
    XUANDIAO = "xuandiao"          # 选调
    OTHER = "other"
```

**Alembic 数据回填**（B10.3）：

```python
# 现有题全部回填为 real_exam
op.execute("UPDATE question_v2 SET source = 'real_exam' WHERE source IS NULL")
op.execute("UPDATE question_v2 SET is_active = TRUE WHERE is_active IS NULL")
op.execute("UPDATE question_v2 SET historical_accuracy = 0.5 WHERE historical_accuracy IS NULL")  # 中位数兜底
# content_hash 回填：现有真题需要扫表批量计算 hash 后写回
# 由 B10.3 中独立 data migration step 完成（避免长事务）
```

⚠️ **content_hash 回填注意**：
- 真题数量可能数千到数万，回填用 batched UPDATE（每批 500-1000 行）
- 回填中如果发现重复 hash（同题多次入库的脏数据）：保留最早记录，其余 is_active=false
- 回填完成后再加 UNIQUE 约束（避免约束失败）

---

### 2.2 PracticeSessionV2（扩展）

```python
# Phase-Home 已加：
linked_plan_event_id: Mapped[int | None] = mapped_column(
    ForeignKey("plan_event_v2.id"), nullable=True
)
linked_recommendation_id: Mapped[int | None] = mapped_column(
    ForeignKey("recommendation_v2.id"), nullable=True
)

# ===== Tab 2 核心字段 =====
practice_mode: Mapped[PracticeMode]                    # per_question | full_set
source_mode: Mapped[SessionSourceMode]                 # paper | category | custom | ai_generated | daily | wrong_redo
config_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)  # 自定义配置快照

# ===== session_lifecycle 字段（详见 12-Session-Lifecycle.md） =====
status: Mapped[SessionStatus]                          # draft | in_progress | paused | submitted | abandoned | expired
paused_at: Mapped[datetime | None]
paused_count: Mapped[int] = mapped_column(default=0)
last_heartbeat_at: Mapped[datetime | None]
expires_at: Mapped[datetime | None]                    # 主动失效时间（daily 当日 23:59 / 自定义最长）
abandoned_at: Mapped[datetime | None]
abandoned_reason: Mapped[str | None] = mapped_column(String(64))
force_submitted: Mapped[bool] = mapped_column(default=False)
force_submitted_reason: Mapped[str | None] = mapped_column(String(64))
recovered_from_session_id: Mapped[int | None] = mapped_column(
    ForeignKey("practice_session_v2.id"), nullable=True
)

# ===== timing 字段（详见 11-Timing-Engine.md） =====
total_active_seconds: Mapped[int] = mapped_column(default=0)
paused_total_seconds: Mapped[int] = mapped_column(default=0)
first_question_at: Mapped[datetime | None]
last_activity_at: Mapped[datetime | None]

# ===== mock_exam 字段（详见 13-Mock-Exam.md） =====
exam_mode: Mapped[bool] = mapped_column(default=False)
time_limit_minutes: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
auto_submit_at: Mapped[datetime | None]                # immutable，详见 §5.3
allow_review_during: Mapped[bool] = mapped_column(default=False)
allow_pause: Mapped[bool] = mapped_column(default=True)
delayed_review_until: Mapped[datetime | None]
```

**枚举**：

```python
class PracticeMode(StrEnum):
    PER_QUESTION = "per_question"   # 逐题模式
    FULL_SET = "full_set"            # 整组模式（默认）

class SessionSourceMode(StrEnum):
    PAPER = "paper"                  # 整卷
    CATEGORY = "category"            # 分类专项
    CUSTOM = "custom"                # 自定义刷题
    AI_GENERATED = "ai_generated"    # AI 出题
    DAILY = "daily"                  # 每日一练
    WRONG_REDO = "wrong_redo"        # 错题重做（来自 review）

class SessionStatus(StrEnum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    SUBMITTED = "submitted"          # 终态
    ABANDONED = "abandoned"          # 终态
    EXPIRED = "expired"              # 终态
```

**Alembic 默认值**：现有 session 全部回填：
- `practice_mode=full_set, source_mode=paper, config_snapshot={}`
- `status=submitted`（旧 session 全部已提交）
- `total_active_seconds=0, paused_total_seconds=0`
- `exam_mode=false, allow_pause=true, allow_review_during=false`

**DB CHECK 约束**（详见 §5.4）：
- `mock_exam_requires_time_limit`：exam_mode=true ⟹ time_limit_minutes IS NOT NULL
- `mock_exam_requires_full_set`：exam_mode=true ⟹ practice_mode='full_set'
- `mock_exam_requires_paper_source`：exam_mode=true ⟹ source_mode='paper'
- `paused_at_status_consistency`：paused_at IS NOT NULL ⟺ status='paused'

---

### 2.3 PracticeSessionAnswerV2（扩展）

```python
# Tab 2 核心字段
flagged: Mapped[bool] = mapped_column(Boolean, default=False)
viewed_solution: Mapped[bool] = mapped_column(Boolean, default=False)
view_solution_at: Mapped[datetime | None]

# ===== timing 字段（详见 11-Timing-Engine.md §2.1） =====
time_spent_ms: Mapped[int] = mapped_column(default=0)
# 累计作答耗时（不含切走切回的间隔）；session.submit 时单区间被截断为 ≤60s

first_seen_at: Mapped[datetime | None]
# 首次进入该题的时刻（用户切到这题）

first_answered_at: Mapped[datetime | None]
# 首次写入 selected_answer 非空的时刻

last_modified_at: Mapped[datetime | None]
# 最后一次修改答案的时刻

answer_change_count: Mapped[int] = mapped_column(default=0)
# 答案修改次数（首次作答不计；改一次 +1）

visit_count: Mapped[int] = mapped_column(default=0)
# 进入该题的次数（切走再切回算多次）

is_overtime: Mapped[bool] = mapped_column(default=False)
# 是否超时（time_spent_ms > QuestionTimingBaselineV2.p95_ms × 1.2）
# 在 session.submit 时根据基线计算并写入；session 进行中始终 false
```

---

### 2.4 NoteV2（扩展，**Tab 4 schema 提前升级**）

```python
# 现有：title, body, user_id, created_at, updated_at, deleted_at（如有）

# Tab 2 新增字段
linked_question_id: Mapped[int | None] = mapped_column(
    ForeignKey("question_v2.id"), nullable=True, index=True
)
visibility: Mapped[NoteVisibility] = mapped_column(default=NoteVisibility.PRIVATE)

__table_args__ = (
    Index("ix_note_v2_user_question", "user_id", "linked_question_id"),
)
```

**枚举**：

```python
class NoteVisibility(StrEnum):
    PRIVATE = "private"             # 仅自己（D-Q17）
    # 远期扩展点：PUBLIC / SHARED_GROUP 等
```

---

### 2.5 ReviewItemV2（扩展 reason 枚举）

```python
# Tab 2 扩展现有 reason 枚举
class ReviewReason(StrEnum):
    WRONG_ANSWER = "wrong_answer"               # 已有
    LOW_CONFIDENCE = "low_confidence"           # 已有
    MANUAL_ADD = "manual_add"                   # 已有
    FLAGGED_PERSISTENT = "flagged_persistent"   # ===== Tab 2 新增 =====
```

---

## 3. 新增表

### 3.1 PracticeStatsSnapshotV2

```python
class PracticeStatsSnapshotV2(Base):
    __tablename__ = "practice_stats_snapshot_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id", ondelete="CASCADE"), index=True)

    # 维度
    scope: Mapped[StatScope]                                 # overall | category_l1 | category_l2
    category_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    type: Mapped[PracticeType]                               # xingce | essay

    # 统计指标
    total_questions: Mapped[int] = mapped_column(default=0)
    correct_count: Mapped[int] = mapped_column(default=0)
    accuracy: Mapped[float] = mapped_column(default=0.0)
    total_sessions: Mapped[int] = mapped_column(default=0)
    total_minutes: Mapped[int] = mapped_column(default=0)
    average_score: Mapped[float | None]                       # 申论用

    # 趋势（近 5-10 次 session）
    recent_trend: Mapped[list] = mapped_column(JSON, default=list)
    last_practiced_at: Mapped[datetime | None]

    # 跨用户对比（仅 scope=category_l1/l2 + 周更新）
    percentile_rank: Mapped[float | None]                    # 0.0-1.0
    percentile_updated_at: Mapped[datetime | None]

    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "scope", "category_key", "type"),
    )
```

**recent_trend JSON shape**：

```json
[
  {"date": "2026-05-15", "session_id": 123, "accuracy": 0.65, "count": 20},
  {"date": "2026-05-17", "session_id": 145, "accuracy": 0.70, "count": 25},
  ...
]
```

枚举：

```python
class StatScope(StrEnum):
    OVERALL = "overall"
    CATEGORY_L1 = "category_l1"
    CATEGORY_L2 = "category_l2"

class PracticeType(StrEnum):
    XINGCE = "xingce"
    ESSAY = "essay"
```

---

### 3.2 QuestionFavoriteV2

```python
class QuestionFavoriteV2(Base):
    __tablename__ = "question_favorite_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("question_v2.id"), index=True)

    note: Mapped[str | None] = mapped_column(String(512), nullable=True)  # 收藏附带的简短备注
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_favorite_user_question"),
    )
```

---

### 3.3 QuestionFlagV2（持久化标记）

```python
class QuestionFlagV2(Base):
    __tablename__ = "question_flag_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("question_v2.id"), index=True)

    reason: Mapped[FlagReason]
    source_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("practice_session_v2.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(default=func.now())
    resolved_at: Mapped[datetime | None]

    __table_args__ = (
        # 同一用户对同一题只能有一条 active flag（resolved_at IS NULL）
        Index(
            "uq_flag_active_per_user_question",
            "user_id", "question_id",
            unique=True,
            postgresql_where=text("resolved_at IS NULL"),
        ),
    )

class FlagReason(StrEnum):
    UNCERTAIN = "uncertain"
    REVISIT_LATER = "revisit_later"
    NEEDS_REVIEW = "needs_review"
```

---

### 3.4 EssayReferenceAnswerV2

```python
class EssayReferenceAnswerV2(Base):
    __tablename__ = "essay_reference_answer_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("question_v2.id"), index=True)

    content: Mapped[str] = mapped_column(Text)

    # 来源
    source: Mapped[ReferenceSource]
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_v2.id"), nullable=True
    )  # source=user_contributed 时
    created_by_admin: Mapped[bool] = mapped_column(default=False)  # source=official 时

    # 质量信号
    likes_count: Mapped[int] = mapped_column(default=0)
    favorites_count: Mapped[int] = mapped_column(default=0)
    report_count: Mapped[int] = mapped_column(default=0)
    quality_score: Mapped[float] = mapped_column(default=5.0)  # 综合评分（cron 更新）

    # 状态
    status: Mapped[ReferenceStatus] = mapped_column(default=ReferenceStatus.DRAFT)
    published_at: Mapped[datetime | None]

    # AI 元数据（仅 source=ai_generated）
    ai_self_audit_passed: Mapped[bool | None]
    ai_generated_at: Mapped[datetime | None]

    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())


class ReferenceSource(StrEnum):
    OFFICIAL = "official"               # 人工补充（管理员录入）
    AI_GENERATED = "ai_generated"
    USER_CONTRIBUTED = "user_contributed"  # 用户贡献

class ReferenceStatus(StrEnum):
    DRAFT = "draft"      # 未通过自审 / 待发布
    PUBLIC = "public"    # 公开可见
    ARCHIVED = "archived"  # 已下线
```

---

### 3.5 EssayReferenceFeedbackV2

```python
class EssayReferenceFeedbackV2(Base):
    __tablename__ = "essay_reference_feedback_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference_id: Mapped[int] = mapped_column(
        ForeignKey("essay_reference_answer_v2.id"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id"), index=True)

    action: Mapped[FeedbackAction]
    note: Mapped[str | None] = mapped_column(String(512))  # report 时的原因
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    __table_args__ = (
        # 同一用户对同一范文同种 action 只一条
        UniqueConstraint("reference_id", "user_id", "action"),
    )

class FeedbackAction(StrEnum):
    LIKE = "like"
    UNLIKE = "unlike"
    FAVORITE = "favorite"
    UNFAVORITE = "unfavorite"
    REPORT = "report"
```

**Trigger**（B13.2）：feedback insert/delete 时同步更新 reference 的 likes_count / favorites_count / report_count。

---

### 3.6 AiGeneratedQuestionRequestV2

```python
class AiGeneratedQuestionRequestV2(Base):
    __tablename__ = "ai_generated_question_request_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id", ondelete="CASCADE"), index=True)

    request_params: Mapped[dict] = mapped_column(JSON)  # 完整 config

    status: Mapped[AiRequestStatus]
    pool_question_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    llm_generated_question_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    llm_self_audit_passed_count: Mapped[int] = mapped_column(default=0)
    llm_call_id: Mapped[int | None] = mapped_column(
        ForeignKey("llm_call_v2.id"), nullable=True
    )  # 关联 LlmCallV2 审计

    error_message: Mapped[str | None] = mapped_column(Text)

    started_at: Mapped[datetime] = mapped_column(default=func.now())
    completed_at: Mapped[datetime | None]
    duration_ms: Mapped[int | None]

class AiRequestStatus(StrEnum):
    PENDING = "pending"
    PARTIAL_POOL = "partial_pool"      # 第一二步够 → 不调 LLM
    LLM_GENERATED = "llm_generated"    # 第三步触发 → 调 LLM
    FAILED = "failed"
```

---

### 3.7 DailyPracticeV2

```python
class DailyPracticeV2(Base):
    __tablename__ = "daily_practice_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id", ondelete="CASCADE"), index=True)

    date: Mapped[date]
    type: Mapped[PracticeType]                               # xingce | essay
    question_ids: Mapped[list[int]] = mapped_column(JSON)
    generation_strategy: Mapped[DailyStrategy]               # weakness_weighted | random_balanced

    # 状态
    status: Mapped[DailyStatus] = mapped_column(default=DailyStatus.PENDING)
    started_at: Mapped[datetime | None]
    completed_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("practice_session_v2.id"), nullable=True
    )
    expired_at: Mapped[datetime]                             # 当日 23:59 UTC

    created_at: Mapped[datetime] = mapped_column(default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "date", "type"),
    )

class DailyStrategy(StrEnum):
    WEAKNESS_WEIGHTED = "weakness_weighted"
    RANDOM_BALANCED = "random_balanced"

class DailyStatus(StrEnum):
    PENDING = "pending"
    STARTED = "started"
    COMPLETED = "completed"
    EXPIRED = "expired"
```

---

### 3.8 QuestionTimingBaselineV2

详见 [11-Timing-Engine §2.3](./11-Timing-Engine.md#23-questiontimingbaselinev2新表)。

```python
class QuestionTimingBaselineV2(Base):
    __tablename__ = "question_timing_baseline_v2"

    question_id: Mapped[int] = mapped_column(
        ForeignKey("question_v2.id"), primary_key=True
    )

    p50_ms: Mapped[int]
    p90_ms: Mapped[int]
    p95_ms: Mapped[int]
    mean_ms: Mapped[int]

    sample_size: Mapped[int]
    # 用于计算基线的答题样本数；< MIN_SAMPLES (默认 30) 不参与超时判定

    last_recomputed_at: Mapped[datetime] = mapped_column(default=func.now())

    __table_args__ = (
        Index("ix_timing_baseline_recomputed", "last_recomputed_at"),
    )
```

由 cron `recompute_question_timing_baseline` 每周一 03:00 写入。

---

### 3.9 UserPracticePreferencesV2

详见 [14-Practice-Preferences §2.1](./14-Practice-Preferences.md#21-userpracticepreferencesv2)。

```python
class UserPracticePreferencesV2(Base):
    __tablename__ = "user_practice_preferences_v2"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("user_v2.id", ondelete="CASCADE"),
        primary_key=True,
    )

    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    # 主体内容（v1 schema 见 14-Practice-Preferences §3.1）

    schema_version: Mapped[int] = mapped_column(SmallInteger, default=1)
    # 数据 schema 版本号，演进时 bump

    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())
```

`payload` v1 子树（详见 14 文档 §3.1）：
```
ui                  # font_size / line_height / theme / panel_position 等
pacing              # default_practice_mode / auto_advance / confirm 等
auto_save           # enabled / interval_seconds / save_to_local_storage
keyboard            # enabled / bindings (a/b/c/d/next/prev/flag/favorite/note/submit)
reminders           # daily_practice / weekly_summary / overtime_threshold / break_reminder
custom_practice     # last_used_* （继承 useSessionConfigStore 内容）
```

---

### 3.10 KnowledgePointV2（Phase-1 schema-only）

详见 [15-Question-Metadata §2.2](./15-Question-Metadata.md#22-knowledgepointv2-表建表无数据)。

```python
class KnowledgePointV2(Base):
    __tablename__ = "knowledge_point_v2"
    __phase__ = "phase_2"   # 提示：Phase 1 仅建表，端点 / cron 在 Phase 2

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(128))
    category_l1: Mapped[str] = mapped_column(String(32), index=True)
    category_l2: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("knowledge_point_v2.id"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    weight_in_exam: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())
```

⚠️ Phase 1 **仅建表**，不写入任何数据。Phase 2 通过 admin 工具或 LLM 辅助批量录入。

---

### 3.11 QuestionKnowledgePointV2（Phase-1 schema-only）

详见 [15-Question-Metadata §2.3](./15-Question-Metadata.md#23-questionknowledgepointv2-关联表建表无数据)。

```python
class QuestionKnowledgePointV2(Base):
    __tablename__ = "question_knowledge_point_v2"
    __phase__ = "phase_2"

    id: Mapped[int] = mapped_column(primary_key=True)

    question_id: Mapped[int] = mapped_column(
        ForeignKey("question_v2.id", ondelete="CASCADE"),
        index=True,
    )
    knowledge_point_id: Mapped[int] = mapped_column(
        ForeignKey("knowledge_point_v2.id"),
        index=True,
    )

    weight: Mapped[float] = mapped_column(Float, default=1.0)
    annotated_by: Mapped[str] = mapped_column(String(32))   # human | llm_auto | llm_assisted
    annotated_at: Mapped[datetime] = mapped_column(default=func.now())
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    __table_args__ = (
        UniqueConstraint("question_id", "knowledge_point_id"),
    )
```

⚠️ Phase 1 **仅建表**，不写入任何数据。Phase 2 由 LLM 自动标注 + admin 二次确认。

---

### 3.12 QuestionReportV2

详见 [03-Backend-WU §24（WU-B30）](./03-Backend-WU.md#24-wu-b30-question_report-模块新建)。用户对**真题或 AI 题**任一道题发起内容纠错（题干错字 / 选项缺失 / 答案存疑 / 解析错误等），由 admin 闭环处理。

```python
class QuestionReportV2(Base):
    __tablename__ = "question_report_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("user_v2.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("question_v2.id"), index=True
    )

    # 报告分类
    category: Mapped[QuestionReportCategory]
    # stem_typo / option_missing / answer_disputed / explanation_wrong /
    # formatting / other（详见枚举）

    description: Mapped[str] = mapped_column(String(1000))
    # 用户填写的描述（最长 1000 字符）

    # 上下文（非必填）
    source_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("practice_session_v2.id"), nullable=True
    )
    # 在哪次 session 中发现的；用于关联用户当时的答题上下文

    selected_answer_at_report: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    # 报告时用户选的答案（用于"答案存疑"类报告分析）

    # 处理状态
    status: Mapped[QuestionReportStatus] = mapped_column(
        default=QuestionReportStatus.PENDING, index=True
    )
    # pending / acknowledged / resolved_fixed / resolved_invalid / resolved_duplicate

    # admin 处理
    handled_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_v2.id"), nullable=True
    )
    handled_at: Mapped[datetime | None]
    admin_response: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    # 给用户的回复（resolved_* 状态时必填）

    duplicate_of_report_id: Mapped[int | None] = mapped_column(
        ForeignKey("question_report_v2.id"), nullable=True
    )
    # status=resolved_duplicate 时指向首报告

    # 处理动作（仅 resolved_fixed 时填）
    applied_fix: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # {"field": "stem|options|correct_answer|explanation", "before": "...", "after": "..."}
    # 仅记录最后一次有效修复；详细审计走 AuditLogV2

    created_at: Mapped[datetime] = mapped_column(default=func.now())

    __table_args__ = (
        # 同一用户对同一题同一类的活跃 report 唯一（防灌水；resolved 后允许新建）
        Index(
            "uq_report_active_per_user_question_category",
            "user_id", "question_id", "category",
            unique=True,
            postgresql_where=text("status IN ('pending', 'acknowledged')"),
        ),
        Index("ix_report_status_created", "status", "created_at"),
    )


class QuestionReportCategory(StrEnum):
    STEM_TYPO = "stem_typo"                    # 题干错字 / 排版错误
    OPTION_MISSING = "option_missing"          # 选项缺失或重复
    ANSWER_DISPUTED = "answer_disputed"        # 答案存疑
    EXPLANATION_WRONG = "explanation_wrong"    # 解析错误
    FORMATTING = "formatting"                  # 格式 / 图片显示问题
    OTHER = "other"


class QuestionReportStatus(StrEnum):
    PENDING = "pending"                        # 待 admin 审阅
    ACKNOWLEDGED = "acknowledged"              # admin 已查看（未处理）
    RESOLVED_FIXED = "resolved_fixed"          # 已修正（终态）
    RESOLVED_INVALID = "resolved_invalid"      # 报告不成立（终态）
    RESOLVED_DUPLICATE = "resolved_duplicate"  # 重复报告（终态，关联 duplicate_of_report_id）
```

**关键约束**（B30 实施）：

- `description` 长度 ∈ [10, 1000]（防灌水 + 防滥提）
- `applied_fix` 仅在 `status=resolved_fixed` 时非空；其他 status 必为 NULL
- `duplicate_of_report_id` 仅在 `status=resolved_duplicate` 时非空
- `handled_at`、`handled_by_admin_id`、`admin_response` 在 status ∈ resolved_* 时必填（CHECK 约束）

**与 AI 题质量信号的协同**：

- AI 题（`source ∈ {ai_generated, ai_modified}`）的 `report_count` 不再依赖 `EssayReferenceFeedbackV2` 那种类型的简单计数，而是改由 cron 同步 `QuestionReportV2.status='pending'+'acknowledged'` 的当前活跃报告数（详见 09 §2.1 metrics `question_report.aggregated_per_question`）。
- 真题（`source=real_exam`）原本无 `report_count` 用途，B30 起也累积同一指标，便于 admin 后台按"被报告最多的题"排序处理。

**自动下线触发**（仅 AI 题 + 边界规则 PR4 扩展）：

- `report_count >= MAX_REPORTS`（默认 5，覆盖 PR4 现有阈值）
- 触发 cron 同步 `QuestionV2.is_active=false`（详见 01 §17 PR-Report-AutoDeactivate）

---

## 4. 索引策略汇总

| 表 | 索引 | 用途 |
|---|---|---|
| QuestionV2 | (category_l1, category_l2) | 二级分类查询 |
| QuestionV2 | (source, is_active) | AI 出题池筛选 |
| QuestionV2 | (year, region, exam_type) | 套卷 filter |
| QuestionV2 | content_hash UNIQUE | 防重复入库（AI 改编 + 真题导入共用） |
| QuestionV2 | heat_score | Phase 2 推荐排序（Phase 1 字段已建） |
| NoteV2 | (user_id, linked_question_id) | 题目相关笔记查询 |
| QuestionFavoriteV2 | UNIQUE(user_id, question_id) | 收藏唯一约束 |
| QuestionFlagV2 | UNIQUE WHERE resolved_at IS NULL | 活跃 flag 唯一约束 |
| PracticeStatsSnapshotV2 | UNIQUE(user_id, scope, category_key, type) | snapshot 唯一约束 |
| EssayReferenceFeedbackV2 | UNIQUE(reference_id, user_id, action) | 反馈唯一约束 |
| DailyPracticeV2 | UNIQUE(user_id, date, type) | 每日一份约束 |
| AiGeneratedQuestionRequestV2 | (user_id, started_at) | 限流计数 |
| PracticeSessionV2 | (status, last_heartbeat_at) | session_lifecycle 心跳超时扫描（cleanup_stale_sessions） |
| PracticeSessionV2 | (status, expires_at) WHERE status IN (in_progress, paused) | mock_exam auto_submit 扫描 + daily expire 扫描 |
| PracticeSessionV2 | (user_id, status, last_activity_at) | GET /sessions/active |
| PracticeSessionV2 | (exam_mode, status, auto_submit_at) WHERE exam_mode=true | mock_exam 倒计时归零扫描 |
| QuestionTimingBaselineV2 | last_recomputed_at | cron 增量重算 |
| KnowledgePointV2 | code UNIQUE; (category_l1, category_l2) | Phase 2 查询树 |
| QuestionKnowledgePointV2 | UNIQUE(question_id, knowledge_point_id) | Phase 2 关联唯一 |
| QuestionReportV2 | UNIQUE(user_id, question_id, category) WHERE status IN (pending, acknowledged) | 防同一用户对同一题同类灌水 |
| QuestionReportV2 | (status, created_at) | admin 后台按状态/时间分页 |

---

## 5. Trigger / 数据完整性

### 5.1 PR2 source immutable trigger

```sql
-- PostgreSQL
CREATE OR REPLACE FUNCTION protect_question_source_v2()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.source IS DISTINCT FROM NEW.source THEN
    RAISE EXCEPTION 'QuestionV2.source is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER question_v2_source_protect
BEFORE UPDATE ON question_v2
FOR EACH ROW EXECUTE FUNCTION protect_question_source_v2();
```

SQLite（开发态）用 application 层校验代替。

### 5.2 EssayReferenceFeedback 计数同步 trigger

```sql
CREATE OR REPLACE FUNCTION sync_reference_feedback_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- 根据 NEW.action 和 OP（INSERT/DELETE）增减 reference 的 likes_count / favorites_count / report_count
  ...
END;
$$ LANGUAGE plpgsql;
```

### 5.3 PracticeSessionV2.auto_submit_at immutable trigger

mock_exam 模式下 `auto_submit_at` 一旦写入不可改（防止运维 / 内部代码延长模考时间）。

```sql
CREATE OR REPLACE FUNCTION protect_auto_submit_at_v2()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.auto_submit_at IS NOT NULL
     AND OLD.auto_submit_at IS DISTINCT FROM NEW.auto_submit_at THEN
    RAISE EXCEPTION 'PracticeSessionV2.auto_submit_at is immutable once set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_v2_auto_submit_at_protect
BEFORE UPDATE ON practice_session_v2
FOR EACH ROW EXECUTE FUNCTION protect_auto_submit_at_v2();
```

### 5.4 mock_exam DB CHECK 约束

```sql
ALTER TABLE practice_session_v2
  ADD CONSTRAINT mock_exam_requires_time_limit CHECK (
    (exam_mode = false) OR (time_limit_minutes IS NOT NULL)
  );

ALTER TABLE practice_session_v2
  ADD CONSTRAINT mock_exam_requires_full_set CHECK (
    (exam_mode = false) OR (practice_mode = 'full_set')
  );

ALTER TABLE practice_session_v2
  ADD CONSTRAINT mock_exam_requires_paper_source CHECK (
    (exam_mode = false) OR (source_mode = 'paper')
  );

ALTER TABLE practice_session_v2
  ADD CONSTRAINT mock_exam_time_limit_range CHECK (
    time_limit_minutes IS NULL OR (time_limit_minutes >= 10 AND time_limit_minutes <= 360)
  );
```

### 5.5 session_lifecycle 状态一致性约束

```sql
ALTER TABLE practice_session_v2
  ADD CONSTRAINT paused_at_status_consistency CHECK (
    (status = 'paused' AND paused_at IS NOT NULL)
    OR (status != 'paused' AND paused_at IS NULL)
  );

ALTER TABLE practice_session_v2
  ADD CONSTRAINT abandoned_reason_required CHECK (
    (status != 'abandoned') OR (abandoned_reason IS NOT NULL)
  );

ALTER TABLE practice_session_v2
  ADD CONSTRAINT force_submit_reason_required CHECK (
    (force_submitted = false) OR (force_submitted_reason IS NOT NULL)
  );
```

### 5.6 终态不可变 trigger（PracticeSessionV2）

```sql
CREATE OR REPLACE FUNCTION protect_session_terminal_state_v2()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('submitted', 'abandoned', 'expired')
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.completed_at IS DISTINCT FROM NEW.completed_at
       OR OLD.abandoned_at IS DISTINCT FROM NEW.abandoned_at
     ) THEN
    RAISE EXCEPTION 'Terminal session status is immutable (was %)', OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_v2_terminal_protect
BEFORE UPDATE ON practice_session_v2
FOR EACH ROW EXECUTE FUNCTION protect_session_terminal_state_v2();
```

### 5.7 QuestionV2 元数据 Phase-1 字段 CHECK

```sql
ALTER TABLE question_v2
  ADD CONSTRAINT question_complexity_range CHECK (
    complexity_level IS NULL OR (complexity_level >= 1 AND complexity_level <= 5)
  );

ALTER TABLE question_v2
  ADD CONSTRAINT question_heat_non_negative CHECK (heat_score >= 0.0);

-- ability_dimensions 元素枚举 (PostgreSQL 用 jsonb_path_exists 校验)
ALTER TABLE question_v2
  ADD CONSTRAINT question_ability_dim_enum CHECK (
    ability_dimensions IS NULL
    OR (ability_dimensions::jsonb <@ '["comprehension", "reasoning", "calculation", "memory", "application"]'::jsonb)
  );
```

### 5.8 QuestionReportV2 状态一致性 CHECK

```sql
ALTER TABLE question_report_v2
  ADD CONSTRAINT report_description_length CHECK (
    char_length(description) >= 10 AND char_length(description) <= 1000
  );

ALTER TABLE question_report_v2
  ADD CONSTRAINT report_resolved_requires_admin CHECK (
    (status NOT IN ('resolved_fixed', 'resolved_invalid', 'resolved_duplicate'))
    OR (handled_by_admin_id IS NOT NULL AND handled_at IS NOT NULL AND admin_response IS NOT NULL)
  );

ALTER TABLE question_report_v2
  ADD CONSTRAINT report_fix_only_when_fixed CHECK (
    (status = 'resolved_fixed' AND applied_fix IS NOT NULL)
    OR (status != 'resolved_fixed' AND applied_fix IS NULL)
  );

ALTER TABLE question_report_v2
  ADD CONSTRAINT report_dup_only_when_duplicate CHECK (
    (status = 'resolved_duplicate' AND duplicate_of_report_id IS NOT NULL)
    OR (status != 'resolved_duplicate' AND duplicate_of_report_id IS NULL)
  );
```

### 5.9 QuestionReportV2 终态不可变 trigger

```sql
CREATE OR REPLACE FUNCTION protect_report_terminal_state_v2()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('resolved_fixed', 'resolved_invalid', 'resolved_duplicate')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Terminal report status is immutable (was %)', OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_v2_terminal_protect
BEFORE UPDATE ON question_report_v2
FOR EACH ROW EXECUTE FUNCTION protect_report_terminal_state_v2();
```

---

## 6. 前端需要消费的字段（OpenAPI / Pydantic Schema）

### 6.1 PracticeSessionEnvelopeV2 扩展

Phase-Home 已有 `PracticeSessionEnvelopeV2`。Tab 2 在响应中追加：

```python
class PracticeSessionEnvelopeV2(CamelModel):
    # 现有字段
    id, status, items, ...

    # ===== Tab 2 核心 =====
    practice_mode: PracticeMode
    source_mode: SessionSourceMode
    config_snapshot: dict | None

    # ===== session_lifecycle 字段 =====
    paused_at: datetime | None
    paused_count: int
    last_heartbeat_at: datetime | None
    expires_at: datetime | None
    force_submitted: bool
    force_submitted_reason: str | None

    # ===== timing 字段 =====
    total_active_seconds: int
    paused_total_seconds: int
    first_question_at: datetime | None
    last_activity_at: datetime | None

    # ===== mock_exam 字段 =====
    exam_mode: bool
    time_limit_minutes: int | None
    auto_submit_at: datetime | None
    delayed_review_until: datetime | None

    # items 内每条 PracticeSessionItemV2 加：
    #   flagged: bool
    #   viewed_solution: bool
    #   has_user_notes: bool                # 是否有该用户的题级笔记
    #   is_favorited: bool                  # 是否被该用户收藏
    #   has_persistent_flag: bool           # 是否被该用户持久标记
    #   time_spent_ms: int                  # 累计耗时
    #   answer_change_count: int
    #   visit_count: int
    #   is_overtime: bool                   # 仅 status=submitted 后有意义
```

### 6.2 PracticeStatsResponseV2

```python
class PracticeStatsResponseV2(CamelModel):
    type: PracticeType
    overall: PracticeStatsCellV2          # scope=overall 的 cell
    by_category_l1: list[PracticeStatsCellV2]
    by_category_l2: list[PracticeStatsCellV2]

class PracticeStatsCellV2(CamelModel):
    category_key: str | None
    label: str
    total_questions: int
    correct_count: int
    accuracy: float
    total_sessions: int
    total_minutes: int
    recent_trend: list[TrendPoint]
    percentile_rank: float | None
    last_practiced_at: datetime | None
```

### 6.3 EssayGradingResponseV2

```python
class EssayGradingResponseV2(CamelModel):
    submission_id: int
    status: EssayGradingStatus       # pending_grading | graded | failed
    report: EssayReportEnvelopeV2 | None  # 仅 status=graded
    reference_answers: list[EssayReferenceAnswerEnvelopeV2]  # 0-5 条
    error_message: str | None        # 仅 status=failed

class EssayReportEnvelopeV2(CamelModel):
    total_score: float
    dimensions: list[GradingDimension]
    highlights: list[str]
    issues: list[str]
    overall_comment: str
    improvement_suggestions: list[str]
    graded_at: datetime
    llm_call_id: int                 # 审计反查
```

### 6.4 AiQuestionsGenerateResponseV2

```python
class AiQuestionsGenerateResponseV2(CamelModel):
    request_id: int                  # AiGeneratedQuestionRequestV2.id
    question_ids: list[int]
    status: AiRequestStatus
    duration_ms: int
    pool_count: int                  # 第一二步贡献多少
    llm_generated_count: int         # 第三步贡献多少
```

### 6.5 DailyPracticeResponseV2

```python
class DailyPracticeResponseV2(CamelModel):
    id: int
    date: date
    type: PracticeType
    question_count: int
    status: DailyStatus
    completed_session_id: int | None
    completed_accuracy: float | None  # 完成后填
```

### 6.6 SessionTimingReportV2（详见 11-Timing-Engine §4.3）

```python
class SessionTimingReportV2(CamelModel):
    total_active_seconds: int
    total_wall_seconds: int
    paused_total_seconds: int
    questions: list[QuestionTimingItemV2]
    summary: TimingSummaryV2

class QuestionTimingItemV2(CamelModel):
    answer_id: int
    question_id: int
    time_spent_ms: int
    baseline_p50_ms: int | None
    baseline_p95_ms: int | None
    is_overtime: bool
    answer_change_count: int
    visit_count: int

class TimingSummaryV2(CamelModel):
    overtime_count: int
    fastest_answer_id: int | None
    slowest_answer_id: int | None
    most_changed_answer_id: int | None
```

### 6.7 PracticeStatsTimingResponseV2（详见 11-Timing-Engine §4.1）

```python
class PracticeStatsTimingResponseV2(CamelModel):
    overall: TimingOverall
    by_category_l1: list[TimingByCategory]
    by_difficulty: list[TimingByDifficulty]
    overtime_questions: TimingOvertimeBucket
    pacing_pattern: Literal["steady", "fast_start_slow_end", "slow_start_fast_end", "irregular"]

class TimingOverall(CamelModel):
    total_minutes: int
    avg_seconds_per_question: float
    vs_baseline_ratio: float

class TimingByCategory(CamelModel):
    category: str
    avg_seconds: float
    vs_baseline_ratio: float
    sample_count: int

class TimingByDifficulty(CamelModel):
    difficulty_bucket: str
    avg_seconds: float
    vs_baseline_ratio: float

class TimingOvertimeBucket(CamelModel):
    count: int
    top_5_question_ids: list[int]
```

### 6.8 SessionLifecycleResponseV2（详见 12-Session-Lifecycle §4.2）

```python
class SessionLifecycleResponseV2(CamelModel):
    status: SessionStatus
    paused_at: datetime | None
    paused_count: int
    last_heartbeat_at: datetime | None
    expires_at: datetime | None
    abandoned_at: datetime | None
    abandoned_reason: str | None
    force_submitted: bool
    force_submitted_reason: str | None
    transitions: list[LifecycleTransition]   # 从 audit log 提取

class LifecycleTransition(CamelModel):
    from_status: SessionStatus
    to_status: SessionStatus
    trigger: str
    actor: Literal["user", "system", "cron", "admin"]
    ts: datetime
    reason: str | None

class ActiveSessionsResponseV2(CamelModel):
    sessions: list[ActiveSessionV2]
    count: int

class ActiveSessionV2(CamelModel):
    id: int
    type: PracticeType
    source_mode: SessionSourceMode
    practice_mode: PracticeMode
    status: SessionStatus
    started_at: datetime
    last_activity_at: datetime
    paused_at: datetime | None
    progress: ActiveSessionProgress
    paper_code: str | None
    category: str | None
    exam_mode: bool

class ActiveSessionProgress(CamelModel):
    answered: int
    total: int
```

### 6.9 MockExamCountdownResponseV2（详见 13-Mock-Exam §3.3）

```python
class MockExamCountdownResponseV2(CamelModel):
    server_now: datetime
    auto_submit_at: datetime
    remaining_seconds: int
    status: SessionStatus
    elapsed_seconds: int

class MockExamHistoryResponseV2(CamelModel):
    sessions: list[MockExamHistoryItem]
    aggregate: MockExamAggregate

class MockExamHistoryItem(CamelModel):
    session_id: int
    paper_code: str
    completed_at: datetime
    time_limit_minutes: int
    actual_active_seconds: int
    accuracy: float
    total_score: float | None
    is_force_submitted: bool
    rank_in_self: int | None

class MockExamAggregate(CamelModel):
    total_count: int
    best_accuracy: float
    best_session_id: int | None
    avg_accuracy: float
    improvement_trend: float
```

### 6.10 PracticePreferencesResponseV2（详见 14-Practice-Preferences §3.1）

```python
class PracticePreferencesResponseV2(CamelModel):
    schema_version: int
    payload: PracticePreferencesPayloadV1
    is_default: bool
    updated_at: datetime | None

# PracticePreferencesPayloadV1 完整结构见 14-Practice-Preferences §3.1
# 此处不重复，避免双源不一致；以 14 文档为唯一规格源
```

---

## 7. Migration 顺序

新增 14 个 Alembic migration（B10-B13 + B25-B30 范围）：

```
revision_id                   | depends_on              | 描述
──────────────────────────────┼─────────────────────────┼──────────────────────────────────
20260521_xx_question_v2       | <Phase-Home WU-B1 last> | QuestionV2 字段扩展（含 source/category/AI/质量）
                              |                         | + 数据回填 + content_hash UNIQUE
20260521_xx_question_meta_p1  | <prev>                  | QuestionV2 加 ability_dimensions /
                              |                         | discrimination_index / heat_score /
                              |                         | complexity_level / knowledge_tags
                              |                         | + KnowledgePointV2 + QuestionKnowledgePointV2
                              |                         | + CHECK 约束（complexity_range / heat_non_negative
                              |                         | / ability_dim_enum）
                              |                         | （schema-only，端点 / cron 在 Phase 2）
20260521_xx_session_ext       | <prev>                  | PracticeSessionV2 + Answer 基础扩展
                              |                         | （practice_mode / source_mode /
                              |                         | flagged / viewed_solution）
20260521_xx_session_lifecycle | <prev>                  | PracticeSessionV2 加 lifecycle 字段
                              |                         | + status 枚举扩展 + paused_at_status_consistency
                              |                         | / abandoned_reason_required
                              |                         | / force_submit_reason_required CHECK
                              |                         | + 终态不可变 trigger
                              |                         | + (user_id, status, last_activity_at) 索引
20260521_xx_session_timing    | <prev>                  | PracticeSessionV2 + Answer 加 timing 字段
                              |                         | + QuestionTimingBaselineV2
20260521_xx_session_mock_exam | <prev>                  | PracticeSessionV2 加 mock_exam 字段
                              |                         | + 4 个 CHECK 约束 + auto_submit_at trigger
                              |                         | + (exam_mode, status, auto_submit_at) 索引
20260521_xx_note_q_link       | <prev>                  | NoteV2 加 linked_question_id
20260521_xx_review_reason     | <prev>                  | ReviewItemV2 reason 枚举扩展
20260521_xx_practice_stats    | <prev>                  | PracticeStatsSnapshotV2
20260521_xx_fav_flag          | <prev>                  | QuestionFavoriteV2 + QuestionFlagV2
20260521_xx_essay_ref         | <prev>                  | EssayReferenceAnswerV2 + Feedback + trigger
20260521_xx_ai_request        | <prev>                  | AiGeneratedQuestionRequestV2
20260521_xx_daily             | <prev>                  | DailyPracticeV2
20260521_xx_user_pref         | <prev>                  | UserPracticePreferencesV2
20260521_xx_question_report   | <prev>                  | QuestionReportV2 + 4 个 CHECK 约束
                              |                         | + 终态不可变 trigger
                              |                         | + 活跃 report 唯一索引
```

每个 migration 必须支持 `alembic downgrade -1`（CI 必跑往返）。

**注意**：以上 14 个 migration 在物理顺序上需保证：
1. `session_lifecycle` 在 `session_timing` 与 `session_mock_exam` 之前（后两者依赖 lifecycle 字段已就绪）
2. `question_v2`、`question_meta_p1` 在 `question_report` 之前（report.question_id FK 需 question_v2 存在）
3. `question_meta_p1` 可与其他 migration 并行只要 `question_v2` 已建

---

## 8. 引用矩阵

| 决策 / 规则 | 数据载体 |
|---|---|
| Q-Source / D-Q1 | QuestionV2.source |
| D-Q9 / AI-G-4/5/6 | QuestionV2.quality_score / report_count / is_active / ai_self_audit_passed |
| D-Q12 基础 | PracticeSessionAnswerV2.flagged |
| D-Q12 拓展 | QuestionFlagV2 + ReviewItemV2 (reason=flagged_persistent) |
| D-Q15 / Pace-Closed-Book | PracticeSessionV2.practice_mode + Answer.viewed_solution（前后端校验） |
| D-Q16 / PR8 | EssaySubmissionV2.status (pending_grading|graded|failed) + EssayReportV2 |
| D-Q17 / Note-Visibility | NoteV2.linked_question_id + visibility |
| D-Q5 / Note-Cross-Tab | NoteV2.linked_question_id (FK QuestionV2) |
| Stat-1 / Q2 二级分类 | QuestionV2.category_l1/l2 + PracticeStatsSnapshotV2.scope |
| Stat-2 / D-Q3 三层 | PracticeStatsSnapshotV2 + 实时聚合 service + percentile_rank |
| Daily-1 / Q7 | DailyPracticeV2 |
| AI-G-3 / D-Q13 三段退化 | AiGeneratedQuestionRequestV2.status |
| Essay-3 / D-Q4 范文优先级 | EssayReferenceAnswerV2.source + status + quality_score |
| **Timing-* (00-Decisions §14)** | **PracticeSessionAnswerV2 timing 字段 + PracticeSessionV2 timing 字段 + QuestionTimingBaselineV2** |
| **Session-LC-* (00-Decisions §15)** | **PracticeSessionV2.status / paused_at / last_heartbeat_at / abandoned_at / force_submitted / recovered_from_session_id** |
| **MockExam-* (00-Decisions §16)** | **PracticeSessionV2.exam_mode / time_limit_minutes / auto_submit_at / allow_pause / delayed_review_until** |
| **Pref-* (00-Decisions §17)** | **UserPracticePreferencesV2** |
| **QMeta-* (00-Decisions §18) Phase 1** | **QuestionV2 ability_dimensions / discrimination_index / heat_score / complexity_level / knowledge_tags + KnowledgePointV2（空表） + QuestionKnowledgePointV2（空表）** |
| **PR-Report-* (01-Boundary-Rules §17) / B30** | **QuestionReportV2 + applied_fix（仅 resolved_fixed） + duplicate_of_report_id（仅 resolved_duplicate） + 终态不可变 trigger** |

---

## 9. 字段命名约定

- Python：snake_case（数据库 + Pydantic 内部）
- API（出向前端）：camelCase（CamelModel 自动转换）
- 时间字段统一 `*_at`，类型 `datetime`，时区 UTC
- 枚举一律 `StrEnum` 子类，序列化为字符串字面量
- JSON 字段必须有 schema 注释（不能裸 `dict`）

---

## 10. 与现有 schemas_v2.py 的整合

所有 Pydantic schema 追加到 `services/api/src/sikao_api/db/schemas_v2.py`（Phase-Home 已建立）。本 Phase 新增的 Pydantic 类前缀：

```
PracticeStatsCellV2, PracticeStatsResponseV2
QuestionFavoriteV2, QuestionFavoriteCreateV2, QuestionFavoriteListV2
QuestionFlagV2, QuestionFlagCreateV2, ...
EssayReferenceAnswerEnvelopeV2, EssayReferenceFeedbackCreateV2
AiQuestionsGenerateRequestV2, AiQuestionsGenerateResponseV2
DailyPracticeResponseV2

# Tab 2 新增模块
SessionTimingReportV2, QuestionTimingItemV2, TimingSummaryV2
PracticeStatsTimingResponseV2, TimingOverall, TimingByCategory, TimingByDifficulty
TimingEventV2, TimingEventBatchV2

SessionLifecycleResponseV2, LifecycleTransition
ActiveSessionsResponseV2, ActiveSessionV2, ActiveSessionProgress
HeartbeatResponseV2, HeartbeatRequestV2

MockExamCreateRequestV2, MockExamCountdownResponseV2
MockExamHistoryResponseV2, MockExamHistoryItem, MockExamAggregate
MockExamComparisonResponseV2

PracticePreferencesResponseV2, PracticePreferencesPayloadV1
PracticePreferencesPatchV2, PracticePreferencesResetRequestV2

# Phase-1 schema 预留（Phase 2 才用）
QuestionMetadataPreviewV2  # 暴露给 QuestionEnvelopeV2.metadata_preview 字段

# B30 question_report
QuestionReportCreateRequestV2, QuestionReportEnvelopeV2
QuestionReportListResponseV2, QuestionReportAdminUpdateRequestV2
```

完整 Pydantic 定义在 [03-Backend-WU §B10-B17 + §B25-B29](./03-Backend-WU.md) 各 PR 内。
