# Phase-Review · 02 · Data Model

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) · [00-Decisions](./00-Decisions.md) · [01-Boundary-Rules](./01-Boundary-Rules.md)

---

## 1. ER 关系图

```
┌─────────────────────────┐
│      QuestionV2         │
│  (Practice 已建)         │
└────────────┬────────────┘
             │ 1
             │
             │ 0..N
┌────────────┴────────────┐         ┌───────────────────────────┐
│     ReviewItemV2        │────────▶│    PracticeSessionV2      │
│  (扩展, WU-R1)          │ linked  │  source_mode=wrong_redo   │
│                         │         └───────────────────────────┘
│  id                     │
│  user_id ──────────────FK users_v2
│  source_kind            │
│  source_id              │
│  title                  │
│  status                 │
│  question_id ──────────FK questions_v2 (ON DELETE SET NULL)
│  essay_submission_id    │
│  correct_streak  ★ NEW  │
│  next_review_at  ★ NEW  │
│  metadata_json (JSONB)  │
│  created_at / updated_at│
└────────────┬────────────┘
             │ 1
             │
             │ 0..N
┌────────────┴────────────┐
│   ReviewAttemptV2       │
│  (扩展 outcome 枚举)    │
│                         │
│  id                     │
│  review_item_id ───────FK review_items_v2 (ON DELETE CASCADE)
│  outcome                │
│  notes_json (JSONB)     │
│  attempted_at           │
└─────────────────────────┘

┌─────────────────────────┐         ┌───────────────────────────┐
│  AiCauseAnalysisV2      │────────▶│       LlmCallV2           │
│  (新建, WU-R1)          │ FK      │  (Phase-Home 已建)         │
│                         │         └───────────────────────────┘
│  id                     │
│  user_id ──────────────FK users_v2
│  scope (single/group)   │
│  question_id ──────────FK questions_v2 (nullable)
│  question_ids_signature │
│  input_hash             │
│  result_json (JSONB)    │
│  llm_call_id ─────────FK llm_calls_v2
│  created_at             │
│  expires_at             │
└─────────────────────────┘

┌─────────────────────────┐
│       NoteV2            │
│  (Phase-Practice 已建)   │
│  type=weekly_review     │◀─── 周回顾生成笔记（不建 WeeklyReviewSummaryV2）
│  type=ai_cause_analysis │◀─── 错因保存为笔记
└─────────────────────────┘
```

---

## 2. 枚举定义

### 2.1 ReviewSourceKind（source_kind 字段）

```python
class ReviewSourceKind(str, Enum):
    """ReviewItemV2.source_kind — 入队来源（PR-R1 / R-1）"""
    WRONG_ANSWER = "wrong_answer"            # session.commit 答错（Practice 写入）
    FLAGGED_PERSISTENT = "flagged_persistent" # session.commit 持久标记（Practice 写入）
    RE_FAILED = "re_failed"                  # graduated 后再做答错（Review WU-R4 写入）
    MANUAL_ADD = "manual_add"                # 用户手动加入复盘（Review WU-R2 写入）
    NOTE_CARD = "note_card"                  # 笔记 AI 摘要拆出卡片（Notes Phase 写入，预留）
```

### 2.2 ReviewItemStatus（status 字段）

```python
class ReviewItemStatus(str, Enum):
    """ReviewItemV2.status — SRS 生命周期状态"""
    PENDING = "pending"           # 新入队，未做过
    IN_PROGRESS = "in_progress"   # 已做至少 1 次，SRS 排期中
    GRADUATED = "graduated"       # 连续答对 N=2 次，已毕业
    ARCHIVED = "archived"         # 用户手动归档（软删）
```

### 2.3 ReviewAttemptOutcome（outcome 字段，扩展）

```python
class ReviewAttemptOutcome(str, Enum):
    """ReviewAttemptV2.outcome — 事件日志类型（扩展既有 stub）"""
    CREATED = "created"           # 行创建事件
    ATTEMPTED = "attempted"       # 旧兼容：未明确对错的尝试
    CORRECT = "correct"           # 答对
    INCORRECT = "incorrect"       # 答错
    GRADUATED = "graduated"       # 状态变更：毕业
    ARCHIVED = "archived"         # 状态变更：归档
    RESTORED = "restored"         # 状态变更：恢复（从 archived）
    RECALL_FILLED = "recall_filled" # 费曼复述填写
```

### 2.4 CauseAnalysisScope（AiCauseAnalysisV2.scope）

```python
class CauseAnalysisScope(str, Enum):
    """AiCauseAnalysisV2.scope — 分析范围"""
    SINGLE = "single"   # 单题错因
    GROUP = "group"     # 多题聚合错因
```

---

## 3. SQLAlchemy 模型

### 3.1 ReviewItemV2 字段扩展

文件位置：`services/api/src/sikao_api/db/models_v2.py`（在既有 ReviewItemV2 class 内追加）

```python
class ReviewItemV2(Base):
    __tablename__ = "review_items_v2"
    __table_args__ = (
        Index("ix_review_items_v2_user_created", "user_id", "created_at"),
        Index("ix_review_items_v2_user_status", "user_id", "status"),
        Index("ix_review_items_v2_user_next_review", "user_id", "next_review_at"),
        Index("ix_review_items_v2_user_source_kind", "user_id", "source_kind"),
        Index("ix_review_items_v2_question", "question_id"),
    )

    # ─── 既有字段（stub，不变）───
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id"))
    source_kind: Mapped[str] = mapped_column(String(32))
    source_id: Mapped[int | None]
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="SET NULL")
    )
    essay_submission_id: Mapped[int | None] = mapped_column(
        ForeignKey("essay_submissions_v2.id", ondelete="SET NULL")
    )
    metadata_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # ─── 新增列（需要索引，提升为 top-level column）★ WU-R1 ───
    correct_streak: Mapped[int] = mapped_column(default=0)
    next_review_at: Mapped[datetime | None] = mapped_column(index=False)  # 复合索引已覆盖

    # ─── metadata_json 内扩展字段（不建列，无索引需求）───
    # algorithm_version: str = "simple_v1"       # 当前算法版本标识
    # ease_factor: float | None = None           # SM-2 预留
    # interval_days: int | None = None           # SM-2 预留
    # repetitions: int | None = None             # SM-2 预留
    # last_answer_hash: str | None = None        # 最后一次答案 hash（错因缓存键）
    # first_seen_at: datetime                    # 首次出现时间（= created_at）
    # last_reviewed_at: datetime | None          # 最近一次复盘尝试时间
    # graduated_at: datetime | None              # 毕业时间
    # archived_at: datetime | None               # 归档时间
    # used_recall: bool = False                  # 费曼复述是否已填
    # source_note_id: int | None                 # note_card 来源笔记 ID
    # original_review_item_id: int | None        # re_failed 时指向原 graduated 行

    # ─── 关系 ───
    attempts: Mapped[list["ReviewAttemptV2"]] = relationship(
        back_populates="review_item", cascade="all, delete-orphan"
    )
```

**metadata_json 规范化 shape**：

```json
{
  "algorithm_version": "simple_v1",
  "ease_factor": null,
  "interval_days": null,
  "repetitions": null,
  "last_answer_hash": "sha256_hex_32chars",
  "first_seen_at": "2026-05-21T10:00:00Z",
  "last_reviewed_at": "2026-05-22T15:30:00Z",
  "graduated_at": null,
  "archived_at": null,
  "used_recall": false,
  "source_note_id": null,
  "original_review_item_id": null
}
```

### 3.2 ReviewAttemptV2（既有表，outcome 枚举扩展）

```python
class ReviewAttemptV2(Base):
    __tablename__ = "review_attempts_v2"
    __table_args__ = (
        Index("ix_review_attempts_v2_item_attempted", "review_item_id", "attempted_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    review_item_id: Mapped[int] = mapped_column(
        ForeignKey("review_items_v2.id", ondelete="CASCADE")
    )
    outcome: Mapped[str] = mapped_column(String(32))
    notes_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict)
    attempted_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # ─── 关系 ───
    review_item: Mapped["ReviewItemV2"] = relationship(back_populates="attempts")
```

**notes_json 规范化 shape**（按 outcome 不同）：

```json
// outcome = "correct" | "incorrect"
{
  "before_streak": 0,
  "after_streak": 1,
  "before_status": "pending",
  "after_status": "in_progress",
  "session_id": 42,
  "recall_text": null
}

// outcome = "graduated"
{
  "before_streak": 1,
  "after_streak": 2,
  "before_status": "in_progress",
  "after_status": "graduated"
}

// outcome = "archived" | "restored"
{
  "before_status": "in_progress",
  "after_status": "archived",
  "reason": "user_manual"
}

// outcome = "recall_filled"
{
  "recall_text": "因为该选项混淆了行政法中的...",
  "interval_bonus_applied": true,
  "session_id": 42
}
```

### 3.3 AiCauseAnalysisV2（新建表）

文件位置：`services/api/src/sikao_api/db/models_v2.py`

```python
class AiCauseAnalysisV2(Base):
    """AI 错因分析结果缓存表（AI-Cause-7）"""
    __tablename__ = "ai_cause_analysis_v2"
    __table_args__ = (
        Index("ix_ai_cause_v2_user_question_hash", "user_id", "question_id", "input_hash"),
        Index("ix_ai_cause_v2_user_signature", "user_id", "question_ids_signature"),
        Index("ix_ai_cause_v2_expires", "expires_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id"))
    scope: Mapped[str] = mapped_column(
        String(16), comment="single | group"
    )  # CauseAnalysisScope enum
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="SET NULL"),
        comment="scope=single 时必填"
    )
    question_ids_signature: Mapped[str | None] = mapped_column(
        String(64),
        comment="scope=group 时必填；sorted question_ids 的 SHA-256 前 64 字符"
    )
    input_hash: Mapped[str] = mapped_column(
        String(64),
        comment="请求输入的 SHA-256（含 last_answer_hash），用于缓存命中判定"
    )
    result_json: Mapped[dict] = mapped_column(
        JSONB_COMPAT,
        comment="LLM 返回的结构化结果"
    )
    llm_call_id: Mapped[int] = mapped_column(
        ForeignKey("llm_calls_v2.id"),
        comment="关联 LLM 调用记录（审计）"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(
        comment="缓存过期时间（created_at + 30d）"
    )
```

**result_json 结构（AI-Cause-3）**：

```json
{
  "summary": "你在行政法复议期限相关题目上反复犯错，核心问题是...",
  "dimensions": [
    {
      "name": "复议期限混淆",
      "severity": "high",
      "suggestion": "建议整理一张 15/30/60/90 天期限对比表"
    },
    {
      "name": "行为主体混淆",
      "severity": "medium",
      "suggestion": "注意区分「行政机关」与「复议机关」的法定职责边界"
    }
  ],
  "suggested_actions": [
    "整理期限对比表并用费曼法复述一遍",
    "挑 3 道该类型题重做"
  ],
  "related_questions": [101, 205, 312]
}
```

---

## 4. SRS 状态机

```
                 ┌─────────────────────────────────────────────┐
                 │                                             │
                 ▼                                             │
┌────────────┐  答对   ┌──────────────┐  答对(streak≥1)  ┌────┴───────┐
│  pending   │───────▶│ in_progress  │─────────────────▶│ graduated  │
│ streak = 0 │        │ streak = 1   │                  │ streak = 2 │
└─────┬──────┘        └──────┬───────┘                  └────────────┘
      │                      │                                │
      │ 答错                  │ 答错                            │ 任意 session 答错
      │ (streak stays 0)     │ (streak → 0)                   │ (新行 re_failed)
      ▼                      ▼                                ▼
  next = +1d             next = +1d                   新 ReviewItemV2
  status=in_progress     status=in_progress           source_kind=re_failed
                                                      streak=0, status=pending

用户手动操作：
  any status ──── archive ────▶ archived
  archived   ──── restore ────▶ pending (streak reset to 0)

注意：
  - graduated 行永不被 UPDATE（SRS-6 / PR-R5）
  - re_failed 创建新行，原行 graduated 状态保留
  - archived 是软删，可恢复
```

---

## 5. 索引策略

| 索引名 | 表 | 列 | 用途 |
|---|---|---|---|
| `ix_review_items_v2_user_created` | review_items_v2 | (user_id, created_at) | 按创建时间排序列表 |
| `ix_review_items_v2_user_status` | review_items_v2 | (user_id, status) | 按状态筛选（活跃 / 已毕业 / 归档） |
| `ix_review_items_v2_user_next_review` | review_items_v2 | (user_id, next_review_at) | SRS 今日队列查询 |
| `ix_review_items_v2_user_source_kind` | review_items_v2 | (user_id, source_kind) | 按入队来源筛选 |
| `ix_review_items_v2_question` | review_items_v2 | (question_id) | 跨 tab 查询"该题是否在复盘中" |
| `ix_review_attempts_v2_item_attempted` | review_attempts_v2 | (review_item_id, attempted_at) | 单题历史时间线 |
| `ix_ai_cause_v2_user_question_hash` | ai_cause_analysis_v2 | (user_id, question_id, input_hash) | 单题缓存命中 |
| `ix_ai_cause_v2_user_signature` | ai_cause_analysis_v2 | (user_id, question_ids_signature) | 多题聚合缓存命中 |
| `ix_ai_cause_v2_expires` | ai_cause_analysis_v2 | (expires_at) | 过期清理 cron |

---

## 6. Alembic 迁移命名规范

```
格式：{序号}_{phase}_{描述}.py
示例：
  0030_review_extend_review_items_v2.py      — ReviewItemV2 新增列
  0031_review_create_ai_cause_analysis_v2.py — 新建 AiCauseAnalysisV2 表
  0032_review_add_indexes.py                 — 补充索引
```

规则：
- 序号承接 Phase-Practice 最后一个迁移号 + 1（假设 Practice 结束于 0029）
- 一个 PR 最多一个迁移文件
- `upgrade()` 和 `downgrade()` 必须对称
- 每个迁移用 `op.execute("SELECT 1")` 做 smoketest（CI 验证可跑）

---

## 7. Pydantic Schema 更新

文件位置：`services/api/src/sikao_api/db/schemas_v2.py`

### 7.1 ReviewItemV2 响应（升级既有）

```python
class ReviewItemResponseV2(CamelModel):
    """复盘条目响应（列表 / 详情共用）"""
    id: int
    source_kind: str                        # ReviewSourceKind
    title: str
    status: str                             # ReviewItemStatus
    correct_streak: int
    next_review_at: datetime | None
    question_id: int | None
    has_user_notes: bool                    # 是否有题级笔记
    has_cause_analysis: bool                # 是否有错因分析缓存
    created_at: datetime
    updated_at: datetime
    # 嵌套简版（列表用）
    question_envelope: QuestionBriefV2 | None = None

class ReviewItemDetailResponseV2(CamelModel):
    """复盘条目详情响应"""
    item: ReviewItemResponseV2
    history: list[ReviewAttemptOutV2]
    actions: list[str]                      # 当前可用操作列表
    srs_state: SrsStateV2
    metadata: dict                          # metadata_json 全量

class SrsStateV2(CamelModel):
    """SRS 当前状态（详情页 + 列表扩展）"""
    algorithm_version: str
    correct_streak: int
    next_review_at: datetime | None
    interval_days: int | None
    is_due_today: bool
    days_overdue: int
```

### 7.2 创建 / 更新请求

```python
class ReviewItemCreateV2(CamelModel):
    """手动加入复盘（source_kind=manual_add）"""
    question_id: int
    title: str | None = None                # 可选，不填则从 QuestionV2.title 取

class ReviewItemBatchActionV2(CamelModel):
    """批量操作"""
    item_ids: list[int]
    action: Literal["archive", "restore", "graduate"]
```

### 7.3 AI 错因分析

```python
class CauseAnalysisRequestV2(CamelModel):
    """单题错因分析请求"""
    question_id: int
    # idempotency_key 通过 header 传递

class CauseAnalysisGroupRequestV2(CamelModel):
    """多题聚合错因分析请求"""
    question_ids: list[int]                 # 2 <= len <= 20

class CauseAnalysisDimension(CamelModel):
    name: str
    severity: Literal["high", "medium", "low"]
    suggestion: str

class CauseAnalysisResponseV2(CamelModel):
    """错因分析响应"""
    id: int                                 # AiCauseAnalysisV2.id
    scope: str                              # single | group
    summary: str
    dimensions: list[CauseAnalysisDimension]
    suggested_actions: list[str]
    related_questions: list[int]
    cached: bool                            # 是否命中缓存
    created_at: datetime
    expires_at: datetime
```

### 7.4 洞察 / 周回顾

```python
class InsightsTrendsResponseV2(CamelModel):
    """错题趋势（90d）"""
    days: list[InsightsDayPoint]

class InsightsDayPoint(CamelModel):
    date: str                               # YYYY-MM-DD
    new_incorrect: int
    graduated: int
    net_accumulation: int

class InsightsCausesResponseV2(CamelModel):
    """错因聚类条形图"""
    causes: list[CauseFrequency]

class CauseFrequency(CamelModel):
    name: str
    count: int
    severity_distribution: dict[str, int]   # {"high": 3, "medium": 5, "low": 2}

class InsightsRedoAccuracyResponseV2(CamelModel):
    """再做正确率（按周）"""
    weeks: list[WeekAccuracyPoint]

class WeekAccuracyPoint(CamelModel):
    week: str                               # YYYY-WW
    total_attempts: int
    correct_count: int
    accuracy_pct: float

class WeeklySummaryResponseV2(CamelModel):
    """周回顾摘要"""
    week: str                               # YYYY-WW
    items_reviewed: int
    redo_accuracy_pct: float
    new_notes_count: int
    new_graduated_count: int
    generated_note_id: int | None           # 已生成笔记的 ID
```

---

## 8. Application-Layer 校验（PR-R7）

```python
# services/api/src/sikao_api/modules/review/application/validators.py

def validate_review_item_source_constraint(item: ReviewItemV2) -> None:
    """
    PR-R7: source_note_id 必填约束。
    - 非 note_card 行：question_id 必填，source_note_id 禁填
    - note_card 行：source_note_id 必填，question_id 可选（NULL=纯知识卡，非 NULL=题关联卡）
    PostgreSQL 可加 DB CHECK 双保险；SQLite 仅依赖此函数。
    """
    source_note_id = item.metadata_json.get("source_note_id")

    if item.source_kind == ReviewSourceKind.NOTE_CARD:
        if source_note_id is None:
            raise ValidationError("note_card 行必须提供 metadata_json.source_note_id")
        # question_id 可 NULL 也可非 NULL（题关联卡），不校验
    else:
        # wrong_answer / flagged_persistent / re_failed / manual_add
        if item.question_id is None:
            raise ValidationError(
                f"source_kind={item.source_kind} 行必须提供 question_id"
            )
        if source_note_id is not None:
            raise ValidationError(
                f"source_kind={item.source_kind} 行不应有 source_note_id"
            )
```

---

## 9. 迁移前后对比

| 维度 | 迁移前（stub） | 迁移后（WU-R1 完工） |
|---|---|---|
| ReviewItemV2 列数 | 10 | 12（+correct_streak, +next_review_at） |
| ReviewItemV2 索引数 | 1 | 5 |
| ReviewAttemptV2 列数 | 5 | 5（不变，outcome 枚举扩展） |
| ReviewAttemptV2 索引数 | 1 | 1（不变） |
| 新表 | — | ai_cause_analysis_v2（1 张） |
| metadata_json 字段 | 无规范 | 12 字段规范化 shape |

---

## 引用矩阵

| 本文被引用 |
|---|
| [03-Backend-WU](./03-Backend-WU.md) WU-R1 / WU-R2 / WU-R3 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR1 类型生成 |
| [05-SRS-Engine](./05-SRS-Engine.md) SRS 字段引用 |
| [06-AI-Cause-Analysis](./06-AI-Cause-Analysis.md) AiCauseAnalysisV2 结构 |
| [11-Testing](./11-Testing.md) 数据模型 invariant |
