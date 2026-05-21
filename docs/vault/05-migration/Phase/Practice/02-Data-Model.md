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
                    └─ ai_self_audit_passed / ai_generated_at        (AI 题专属)
                    │
                    ↓
  ┌─────────────────────────────────────────────────────┐
  │ QuestionFavoriteV2 (NEW)  ─ user-question 收藏关系    │
  │ QuestionFlagV2 (NEW)      ─ user-question 持久标记     │
  └─────────────────────────────────────────────────────┘

PracticeSessionV2 (扩展)──┐
                          ├─ practice_mode (per_question | full_set)
                          ├─ source_mode (paper|category|custom|ai_generated|daily|wrong_redo)
                          └─ config_snapshot (JSON)

PracticeSessionAnswerV2 (扩展)──┐
                                ├─ flagged                (本次 session 内)
                                └─ viewed_solution / view_solution_at  (逐题模式)

NoteV2 (扩展) ──┬─ linked_question_id (FK QuestionV2 nullable)
               └─ visibility (private)

ReviewItemV2 (扩展) ─ reason 枚举加 flagged_persistent

PracticeStatsSnapshotV2 (NEW) ─ 用户 × scope × type 聚合快照
                                ├─ overall / category_l1 / category_l2 三种 scope
                                └─ percentile_rank (周更新)

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

    # AI 题专属
    ai_source_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("question_v2.id"), nullable=True
    )  # 改编自哪道真题
    ai_self_audit_passed: Mapped[bool | None]
    ai_generated_at: Mapped[datetime | None]

    __table_args__ = (
        Index("ix_question_v2_category", "category_l1", "category_l2"),
        Index("ix_question_v2_source_active", "source", "is_active"),
        Index("ix_question_v2_year_region_exam", "year", "region", "exam_type"),
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
```

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

# ===== Tab 2 新增字段 =====
practice_mode: Mapped[PracticeMode]                    # per_question | full_set
source_mode: Mapped[SessionSourceMode]                 # paper | category | custom | ai_generated | daily | wrong_redo
config_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)  # 自定义配置快照
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
```

**Alembic 默认值**：现有 session 全部回填 `practice_mode=full_set, source_mode=paper, config_snapshot={}`（不影响业务）

---

### 2.3 PracticeSessionAnswerV2（扩展）

```python
# Tab 2 新增字段
flagged: Mapped[bool] = mapped_column(Boolean, default=False)
viewed_solution: Mapped[bool] = mapped_column(Boolean, default=False)
view_solution_at: Mapped[datetime | None]
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

## 4. 索引策略汇总

| 表 | 索引 | 用途 |
|---|---|---|
| QuestionV2 | (category_l1, category_l2) | 二级分类查询 |
| QuestionV2 | (source, is_active) | AI 出题池筛选 |
| QuestionV2 | (year, region, exam_type) | 套卷 filter |
| NoteV2 | (user_id, linked_question_id) | 题目相关笔记查询 |
| QuestionFavoriteV2 | UNIQUE(user_id, question_id) | 收藏唯一约束 |
| QuestionFlagV2 | UNIQUE WHERE resolved_at IS NULL | 活跃 flag 唯一约束 |
| PracticeStatsSnapshotV2 | UNIQUE(user_id, scope, category_key, type) | snapshot 唯一约束 |
| EssayReferenceFeedbackV2 | UNIQUE(reference_id, user_id, action) | 反馈唯一约束 |
| DailyPracticeV2 | UNIQUE(user_id, date, type) | 每日一份约束 |
| AiGeneratedQuestionRequestV2 | (user_id, started_at) | 限流计数 |

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

---

## 6. 前端需要消费的字段（OpenAPI / Pydantic Schema）

### 6.1 PracticeSessionEnvelopeV2 扩展

Phase-Home 已有 `PracticeSessionEnvelopeV2`。Tab 2 在响应中追加：

```python
class PracticeSessionEnvelopeV2(CamelModel):
    # 现有字段
    id, status, items, ...

    # ===== Tab 2 新增 =====
    practice_mode: PracticeMode
    source_mode: SessionSourceMode
    config_snapshot: dict | None
    # items 内每条 PracticeSessionItemV2 加：
    #   flagged: bool
    #   viewed_solution: bool
    #   has_user_notes: bool                # 是否有该用户的题级笔记
    #   is_favorited: bool                  # 是否被该用户收藏
    #   has_persistent_flag: bool           # 是否被该用户持久标记
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

---

## 7. Migration 顺序

新增 7 个 Alembic migration（B10-B13 范围）：

```
revision_id              | depends_on              | 描述
─────────────────────────┼─────────────────────────┼──────────────────────────
20260521_xx_question_v2  | <Phase-Home WU-B1 last> | QuestionV2 字段扩展 + 数据回填
20260521_xx_session_ext  | <prev>                  | PracticeSessionV2 + Answer 扩展
20260521_xx_note_q_link  | <prev>                  | NoteV2 加 linked_question_id
20260521_xx_review_reason | <prev>                 | ReviewItemV2 reason 枚举扩展
20260521_xx_practice_stats | <prev>                | PracticeStatsSnapshotV2
20260521_xx_fav_flag     | <prev>                  | QuestionFavoriteV2 + QuestionFlagV2
20260521_xx_essay_ref    | <prev>                  | EssayReferenceAnswerV2 + Feedback + trigger
20260521_xx_ai_request   | <prev>                  | AiGeneratedQuestionRequestV2
20260521_xx_daily        | <prev>                  | DailyPracticeV2
```

每个 migration 必须支持 `alembic downgrade -1`（CI 必跑往返）。

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
```

完整 Pydantic 定义在 [03-Backend-WU §B10-B17](./03-Backend-WU.md) 各 PR 内。
