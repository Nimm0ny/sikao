# Phase-Home · 02 · Data Model

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Convention**: Python type hints; SQLAlchemy 2.0 declarative；Alembic migration 字段顺序与本文件 §3 一致

---

## 1. ER 总览

```
ProfileGoalV2 ──┐
                ├─ exam_targets[] (JSON)
ProfileInfoV2 ──┤
                └─ ai_adjust_enabled / dashboard_preferences / recommender_preferences

UserV2 ─┬─→ PlanV2 (1:N)
        │     ├─ change_log (JSON, P6)
        │     └─→ PlanEventV2 (1:N)
        │           ├─ recurring_parent_id (self-ref nullable)
        │           ├─ change_log (JSON, P6)
        │           └─ deleted_at (soft delete, Cust-8)
        │
        ├─→ PlanAdjustmentV2 (1:N)
        │     ├─ status: pending|accepted|rejected|expired
        │     └─ changes (JSON)
        │
        ├─→ RecommendationV2 (1:N)
        │     └─→ RecommendationFeedbackV2 (1:N)
        │
        └─→ PracticeSessionV2 (existing, +linked_plan_event_id, +linked_recommendation_id)

System tables:
  AuditLogV2 ─ (polymorphic, NF-Audit)
  IdempotencyKeyV2 ─ (AI-8)
  LlmCallV2 ─ (NF-Audit)
```

---

## 2. 核心表

> 实现现实（A0 修订）：本 Phase 新增/扩展的 ORM class **不拆分到 `db/models/*.py`**，统一追加到 `services/api/src/sikao_api/db/models_v2.py`；本文以下 class block 是逻辑定义，不代表文件拆分方式。

### 2.1 PlanV2

```python
class PlanV2(Base):
    __tablename__ = "plan_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id", ondelete="CASCADE"), index=True)

    name: Mapped[str] = mapped_column(String(120))
    target_exam_id: Mapped[str] = mapped_column(String(64))   # "guokao" / "shengkao_xx" / "shiye_xx"
    target_exam_date: Mapped[date]
    daily_minutes_target: Mapped[int]                          # 60-720
    style: Mapped[PlanStyle]                                   # loose | standard | aggressive
    baseline: Mapped[dict] = mapped_column(JSON)               # {xingce_score, essay_score, ...}
    focus_subjects: Mapped[list[str]] = mapped_column(JSON)    # ["yanyu", "panduan"]

    status: Mapped[PlanStatus]                                 # active | paused | archived
    source: Mapped[PlanSource]                                 # user_manual | ai_generated
    change_log: Mapped[list[dict]] = mapped_column(JSON, default=list)  # P6 audit

    deleted_at: Mapped[datetime | None] = mapped_column(index=True)     # soft delete
    archived_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_plan_v2_user_status", "user_id", "status"),
        Index("ix_plan_v2_user_active", "user_id", postgresql_where="status='active' AND deleted_at IS NULL"),
        CheckConstraint("daily_minutes_target BETWEEN 60 AND 720", name="ck_plan_v2_minutes"),
    )
```

**业务规则**：
- 同一用户最多 1 个 `active` 的 plan（partial unique index 强制，写入层校验）
- `target_exam_date` 必须 ≥ created_at + 1 day（写入校验）
- `change_log` 每条 = `{at, actor, type, before, after, reason}`，type ∈ create/update/archive/restore

---

### 2.2 PlanEventV2

```python
class PlanEventV2(Base):
    __tablename__ = "plan_event_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plan_v2.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id", ondelete="CASCADE"), index=True)

    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[EventCategory]                # xingce | essay | review | mock | break | custom
    notes: Mapped[str] = mapped_column(Text, default="")

    start_at: Mapped[datetime]                     # UTC
    end_at: Mapped[datetime]                       # UTC，end_at > start_at
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Shanghai")

    # RRULE (Cal-4)
    recurring_rule: Mapped[str | None] = mapped_column(Text)              # "FREQ=DAILY;COUNT=30"
    recurring_parent_id: Mapped[int | None] = mapped_column(ForeignKey("plan_event_v2.id", ondelete="CASCADE"))
    recurring_exception_dates: Mapped[list[str]] = mapped_column(JSON, default=list)
    # 单次例外（detached event 用 parent_id 指向母规则但 recurring_rule=NULL，
    # recurring_exception_dates 在 parent 上加该日，子事件以独立行存在）

    status: Mapped[EventStatus]                    # planned | in_progress | done | skipped
    source: Mapped[EventSource]                   # user_manual | ai_generated | ai_adjusted

    linked_session_id: Mapped[int | None] = mapped_column(ForeignKey("practice_session_v2.id"))
    target_id: Mapped[int | None]                  # ProfileGoal.exam_targets 数组下标（不是外键）

    change_log: Mapped[list[dict]] = mapped_column(JSON, default=list)  # P6
    deleted_at: Mapped[datetime | None] = mapped_column(index=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_event_v2_user_range", "user_id", "start_at", "end_at"),
        Index("ix_event_v2_plan_range", "plan_id", "start_at"),
        Index("ix_event_v2_recurring_parent", "recurring_parent_id"),
        Index("ix_event_v2_user_alive", "user_id", postgresql_where="deleted_at IS NULL"),
        CheckConstraint("end_at > start_at", name="ck_event_v2_time_window"),
    )
```

**字段语义**：
- `recurring_rule` 非空 = "母规则行"，UI 上显示为虚拟实例集合。
- `recurring_parent_id` 非空 + `recurring_rule` 空 = "单次例外"（detached），覆盖父规则在某个日期的展开（"仅此次"编辑落地）。
- `recurring_parent_id` 非空 + `recurring_rule` 非空 = "后续所有"分裂出的新规则（截断父规则的 UNTIL，从分裂日开始新规则）。
- `target_id` 是 `ProfileGoal.exam_targets[]` 的索引。Stage 2 多用户时，考虑改成单独 ExamTargetV2 表 + FK。

---

### 2.3 PlanAdjustmentV2

```python
class PlanAdjustmentV2(Base):
    __tablename__ = "plan_adjustment_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plan_v2.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id", ondelete="CASCADE"), index=True)

    proposed_at: Mapped[datetime] = mapped_column(server_default=func.now())
    expires_at: Mapped[datetime]                                # proposed_at + 24h
    decided_at: Mapped[datetime | None]

    reason: Mapped[str] = mapped_column(Text)                    # AI 给的原因
    changes: Mapped[list[dict]] = mapped_column(JSON)
    # changes = [
    #   {"event_id": 123, "action": "edit", "before": {...}, "after": {...}, "diff_summary": "..."},
    #   {"event_id": null, "action": "add", "after": {...}, "diff_summary": "..."},
    #   {"event_id": 456, "action": "delete", "before": {...}, "diff_summary": "..."},
    # ]

    status: Mapped[AdjustmentStatus]                            # pending | accepted | rejected | expired
    source: Mapped[AdjustmentSource]                            # cron_daily | login_check | event_skipped

    llm_call_id: Mapped[int | None] = mapped_column(ForeignKey("llm_call_v2.id"))  # 审计反查
    user_reject_reason: Mapped[str | None]

    __table_args__ = (
        Index("ix_adj_v2_user_status", "user_id", "status"),
        Index("ix_adj_v2_pending_expires", "expires_at", postgresql_where="status='pending'"),
    )
```

---

### 2.4 RecommendationV2

```python
class RecommendationV2(Base):
    __tablename__ = "recommendation_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id", ondelete="CASCADE"), index=True)

    title: Mapped[str] = mapped_column(String(200))
    reason: Mapped[str] = mapped_column(Text)
    estimated_minutes: Mapped[int]
    cta: Mapped[str] = mapped_column(String(40))                # "去做" / "去复盘" / "休息一下"
    action_type: Mapped[RecommendationAction]                   # review | continue | rest

    payload: Mapped[dict] = mapped_column(JSON)
    # payload = {
    #   "session_template": {"category": "xingce", "subject": "yanyu", "count": 10},
    #   "review_item_ids": [101, 102],
    #   "rest_minutes": 15,
    # }

    generated_at: Mapped[datetime] = mapped_column(server_default=func.now())
    expires_at: Mapped[datetime]                                # generated_at + 4h
    served_count: Mapped[int] = mapped_column(default=0)

    status: Mapped[RecommendationStatus]
    accepted_at: Mapped[datetime | None]
    rejected_at: Mapped[datetime | None]

    source_signals: Mapped[dict] = mapped_column(JSON)
    # source_signals = {accuracy_recent_50, fatigue_minutes, accumulated_review_count, ...}
    llm_call_id: Mapped[int | None] = mapped_column(ForeignKey("llm_call_v2.id"))

    __table_args__ = (
        Index("ix_rec_v2_user_status", "user_id", "status"),
        Index("ix_rec_v2_active", "user_id", "expires_at", postgresql_where="status='pending'"),
    )


class RecommendationFeedbackV2(Base):
    __tablename__ = "recommendation_feedback_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    recommendation_id: Mapped[int] = mapped_column(ForeignKey("recommendation_v2.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(String(40))             # "已经做过" / "不感兴趣" / "估时太长" / "其他"
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

---

### 2.5 Profile 扩展

ProfileGoalV2（已存在）增加：

```python
exam_targets: Mapped[list[dict]] = mapped_column(JSON, default=list)
# exam_targets = [
#   {"exam_id": "guokao_2027", "exam_date": "2027-11-26", "exam_name": "国考 2027", "subjects": ["xingce", "essay"]},
#   {"exam_id": "shengkao_zj_2027", "exam_date": "2027-04-22", ...}
# ]
```

ProfileInfoV2（已存在）增加：

```python
ai_adjust_enabled: Mapped[bool] = mapped_column(default=True)            # ADJ-4
dashboard_preferences: Mapped[dict] = mapped_column(JSON, default=dict)
# dashboard_preferences = {
#   "section_a_visible": true,
#   "section_b_visible": true,
#   "section_c_visible": true,
#   "section_order": ["a", "b", "c"],
#   "calendar_default_view": "today",
# }
recommender_preferences: Mapped[dict] = mapped_column(JSON, default=dict)
# 详见 01-Boundary-Rules.md §2.4，Stage 1 不暴露 UI
```

---

### 2.6 PracticeSessionV2 扩展

```python
linked_plan_event_id: Mapped[int | None] = mapped_column(
    ForeignKey("plan_event_v2.id", ondelete="SET NULL"),
    index=True,
)
linked_recommendation_id: Mapped[int | None] = mapped_column(
    ForeignKey("recommendation_v2.id", ondelete="SET NULL"),
    index=True,
)
```

注：FK on_delete = SET NULL（事件软删时不会触发，但物理清理 30 天后会）。

---

### 2.7 IdempotencyKeyV2（AI-8）

```python
class IdempotencyKeyV2(Base):
    __tablename__ = "idempotency_key_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(64))                 # client UUID
    user_id: Mapped[int] = mapped_column(index=True)
    endpoint: Mapped[str] = mapped_column(String(120))           # "POST /plans/auto-generate"
    request_hash: Mapped[str] = mapped_column(String(64))        # sha256(body)
    response_status: Mapped[int]
    response_body: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    expires_at: Mapped[datetime]                                  # created_at + 24h

    __table_args__ = (
        UniqueConstraint("key", "user_id", "endpoint", name="uq_idem_key"),
        Index("ix_idem_expires", "expires_at"),
    )
```

---

### 2.8 LlmCallV2（NF-Audit）

```python
class LlmCallV2(Base):
    __tablename__ = "llm_call_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_v2.id"), index=True)

    purpose: Mapped[LlmPurpose]               # plan_generate | plan_regenerate_range | plan_adjust | recommend_today
    prompt_version: Mapped[str] = mapped_column(String(20))      # "plan_generate@v1"
    provider: Mapped[str] = mapped_column(String(40))            # "deepseek" / "dashscope" / "mock"
    model: Mapped[str] = mapped_column(String(80))

    input_tokens: Mapped[int | None]
    output_tokens: Mapped[int | None]
    cost_cny: Mapped[float | None]                                # 计算后冗余存
    latency_ms: Mapped[int]

    request_payload: Mapped[dict] = mapped_column(JSON)           # 含 sanitized 用户输入
    response_payload: Mapped[dict | None] = mapped_column(JSON)   # 解析前原文（截断 32KB）
    parsed_output: Mapped[dict | None] = mapped_column(JSON)      # parser 输出
    parse_status: Mapped[ParseStatus]                             # ok | invalid_json | schema_violation | empty

    error_class: Mapped[str | None] = mapped_column(String(80))
    error_message: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("ix_llm_user_purpose", "user_id", "purpose", "created_at"),
        Index("ix_llm_parse_failed", "parse_status", postgresql_where="parse_status != 'ok'"),
    )
```

---

### 2.9 AuditLogV2（NF-Audit, 多态）

```python
class AuditLogV2(Base):
    __tablename__ = "audit_log_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    actor_type: Mapped[ActorType]                # user | ai | system | cron
    actor_id: Mapped[str] = mapped_column(String(40))   # 用户 id / "ai:plan_adjustor" / "cron:daily_progress"

    action: Mapped[str] = mapped_column(String(60))     # "event.create" / "plan.archive" / "adjustment.accept"
    target_type: Mapped[str] = mapped_column(String(40))  # "plan_event_v2" / "plan_v2" / ...
    target_id: Mapped[int | None]

    before: Mapped[dict | None] = mapped_column(JSON)
    after: Mapped[dict | None] = mapped_column(JSON)
    diff: Mapped[dict | None] = mapped_column(JSON)
    metadata: Mapped[dict] = mapped_column(JSON, default=dict)

    request_id: Mapped[str | None] = mapped_column(String(64))   # X-Request-ID
    ip: Mapped[str | None] = mapped_column(String(45))

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("ix_audit_user_action_at", "user_id", "action", "created_at"),
        Index("ix_audit_target", "target_type", "target_id"),
    )
```

> 写入策略：所有 plan / event 变更必须落 audit + change_log（双写）。change_log 是 inline 给 UI 的 timeline 用，audit_log 是合规/反查用。两者 reason / actor 必须一致。

---

## 3. 状态机

### 3.1 PlanV2.status

```
draft (transient, 不入库)
  ↓ POST /plans
active ──[POST /plans/:id/archive]──→ archived
active ──[POST /plans/:id/pause]──→ paused
paused ──[POST /plans/:id/activate]──→ active
* 任何状态 ──[soft delete]──→ deleted_at != null（不在状态机内，独立维度）
```

约束：
- 同用户至多 1 个 active；archive 当前 active 时如有别的 paused，不会自动 activate（用户显式触发）。
- 必须存在 1 个 active 才允许写 PlanEventV2（写入层校验）。

### 3.2 PlanEventV2.status

```
planned ──[time enters [start_at, end_at) AND linked session created]──→ in_progress
planned ──[time exits end_at, no linked session]──→ skipped
in_progress ──[time exits end_at, ≥1 linked session submitted]──→ done
in_progress ──[time exits end_at, 0 linked session submitted]──→ skipped
* 任何 ──[user manually mark done/skipped]──→ done|skipped
```

驱动方式：
- 时间驱动 = APScheduler 每 15 分钟跑一次 `update_event_statuses_in_window` cron（高频但 query 轻）
- session 驱动 = session.create / session.submit hook 即时更新

### 3.3 PlanAdjustmentV2.status

```
pending ──[user POST accept]──→ accepted ──[apply changes to events, write audit]──→ (terminal)
pending ──[user POST reject]──→ rejected
pending ──[expires_at < now via cron]──→ expired
```

### 3.4 重复事件展开规则

DB 表示：
- **母规则行** (M): `recurring_rule != NULL`, `recurring_parent_id = NULL`, 它的 `start_at/end_at` 是序列首次实例
- **detached 单次例外** (X): `recurring_rule = NULL`, `recurring_parent_id = M.id`, 其 `start_at` 必在母规则的 `recurring_exception_dates` 里
- **后续所有分裂** (M2): 创建 M2 时必同步给 M 的 RRULE 加 `UNTIL=<分裂日 - 1天>`，M2 是新母规则

虚拟实例 ID 约定（API 层）：
- 母规则展开的某次实例 ID = `"<M.id>:<occurrence_iso_date>"`，例如 `"100:2026-06-15"`
- detached 实例 ID = 自身整数 id（X.id）

API 层细节：
- `GET /events?from=&to=` 返回时把母规则展开为虚拟实例数组，每条带 `id`, `parent_id`, `is_recurring_instance`
- `PATCH /events/:id?scope=this` 时如果 `id` 是虚拟实例，后端创建 X 行 + 更新 M.exception_dates
- `PATCH /events/:id?scope=future` 时创建 M2 + 截断 M.UNTIL
- `PATCH /events/:id?scope=all` 时直接改 M

### 3.5 RRULE 子集（必须支持）

| RRULE 部件 | 是否支持 | 说明 |
|---|---|---|
| FREQ | ✅ | DAILY / WEEKLY / MONTHLY |
| INTERVAL | ✅ | 1-99 |
| COUNT | ✅ | 1-365 |
| UNTIL | ✅ | UTC 日期 |
| BYDAY | ✅ | MO/TU/WE/TH/FR/SA/SU |
| BYMONTHDAY | ✅ | -1 到 31 |
| EXDATE | ✅ | 通过 `recurring_exception_dates` 实现 |
| BYHOUR/BYMINUTE | ❌ | 不支持（用 start_at 表达） |
| YEARLY / SECONDLY 等 | ❌ | 不支持 |

---

## 4. 索引策略

| 表 | 索引 | 目的 |
|---|---|---|
| plan_event_v2 | `(user_id, start_at, end_at)` | 范围查询 events?from=&to= |
| plan_event_v2 | `(plan_id, start_at)` | plan slice |
| plan_event_v2 | `(recurring_parent_id)` | 拉取 detached 实例 |
| plan_event_v2 | partial `(user_id) WHERE deleted_at IS NULL` | 默认列表 |
| plan_v2 | partial unique `(user_id) WHERE status='active' AND deleted_at IS NULL` | 单 active 约束 |
| recommendation_v2 | partial `(user_id, expires_at) WHERE status='pending'` | 取 active 推荐 |
| llm_call_v2 | `(user_id, purpose, created_at)` | cost dashboard / debug |
| audit_log_v2 | `(user_id, action, created_at)` + `(target_type, target_id)` | 审计反查 |

---

## 5. 软删除策略（Cust-8 / Infra-SoftDelete）

| 表 | 软删除？ | 物理清理 |
|---|---|---|
| plan_v2 | ✅ deleted_at | 不自动清，归档表保留 |
| plan_event_v2 | ✅ deleted_at | 30 天后 cron 物理 delete（保 audit_log_v2 历史） |
| plan_adjustment_v2 | ❌ | 用 status=expired |
| recommendation_v2 | ❌ | 用 status=expired |
| practice_session_v2 | ❌ | 永久保留（实绩不可删） |

软删除 SQL 模式：所有列表查询走 SQLAlchemy `with_loader_criteria` 自动加 `deleted_at IS NULL`，detail 端点显式控制（用户可看已删事件）。

---

## 6. API 响应 shape

### 6.1 GET /events?include_practice_blocks=true

```json
{
  "data": {
    "events": [
      {
        "id": "100",
        "is_recurring_instance": false,
        "title": "...",
        "start_at": "...",
        "end_at": "...",
        "status": "planned",
        "source": "ai_generated",
        "category": "xingce",
        "linked_session_id": null,
        "target_id": 0,
        "deleted_at": null
      },
      {
        "id": "101:2026-06-15",
        "parent_id": 101,
        "is_recurring_instance": true,
        "title": "...",
        "start_at": "...",
        "end_at": "...",
        "status": "planned"
      }
    ],
    "practice_blocks": [
      {
        "id": "session:5023",
        "session_id": 5023,
        "start_at": "2026-06-15T19:30:00Z",
        "end_at": "2026-06-15T19:55:00Z",
        "items_count": 20,
        "accuracy": 0.65,
        "category": "xingce",
        "subject": "yanyu",
        "is_in_progress": false
      }
    ]
  },
  "meta": {
    "from": "2026-06-15",
    "to": "2026-06-21",
    "include_practice_blocks": true,
    "tz": "Asia/Shanghai"
  }
}
```

### 6.2 GET /dashboard/progress（D-Full）

```json
{
  "data": {
    "summary": {
      "today": {
        "minutes_practiced": 75,
        "items_answered": 120,
        "accuracy": 0.68,
        "minutes_target": 90
      },
      "week": {...},
      "all_time": {...},
      "plan_slice": {
        "plan_id": 7,
        "events_in_window_total": 12,
        "events_done": 10,
        "events_skipped": 2,
        "minutes_target_in_window": 720,
        "minutes_practiced_in_window": 690
      }
    },
    "weakness_top3": [
      {"subject": "yanyu", "subtype": "luoji_panduan", "accuracy": 0.42, "trend": "declining"},
      ...
    ]
  }
}
```

`/dashboard/progress/timeseries`、`/weakness`（全量）、`/diagnosis` 单独端点见 `03-Backend-WU.md` WU-B4。

### 6.3 GET /profile/records（canonical）

```json
{
  "items": [
    {
      "id": "practice-5023",
      "kind": "xingce_practice",
      "title": "Xingce practice",
      "status": "completed",
      "score": null,
      "occurred_at": "2026-06-15T19:30:00Z"
    },
    {
      "id": "essay-submission-88",
      "kind": "essay_submission",
      "title": "Essay submission",
      "status": "pending",
      "score": null,
      "occurred_at": "2026-06-15T21:10:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

请求参数：
- `page`, `size`
- `kind`
- `status`
- `from`, `to`
- `session_id`

约束：
- canonical 端点为 `GET /api/v2/profile/records`
- 现有 `GET /api/v2/dashboard/records` 仅作为兼容 shim 暂留到 `B9.5` OpenAPI 收口前
- 响应固定使用 `LearningRecordListResponseV2`，按日分组由前端完成，不新增 grouped response

### 6.4 通用 error envelope

```json
{
  "error": {
    "code": "LLM_SERVICE_UNAVAILABLE",
    "message": "AI 服务暂时不可用，请稍后重试",
    "details": {"retry_after_seconds": 30},
    "request_id": "req_abc123"
  }
}
```

---

## 7. Drop 表（Infra-DailyPlan-drop）

零迁移（无真实数据）：

```python
# alembic migration B1.5
def upgrade():
    op.drop_table("daily_plan_v2")
    op.drop_table("weekly_plan_v2")

def downgrade():
    pass  # 不可逆（用户拍板）
```

风险：若文档/测试代码还引用了这两个表，B1.5 之前必须先完成 `B5.1` 旧 planning 引用清理与 `B5.1a legacy study_plan cleanup`。grep 范围 = 整个 services/api。

---

## 8. Alembic 迁移顺序（与 B1.x PR 拆分对齐）

```
2026XXXX_b1_1_create_plan_v2_and_plan_event_v2.py
2026XXXX_b1_2_create_plan_adjustment_v2.py
2026XXXX_b1_3_create_recommendation_v2_and_feedback.py
2026XXXX_b1_4_extend_profile_and_session_links_idempotency_audit_llmcall.py
2026XXXX_b1_5_drop_daily_weekly_plan_v2.py
```

每个 migration 必须可 `alembic upgrade head` + `alembic downgrade -1` 来回（除 B1.5 downgrade 为空）。

---

## 9. 数据约束总览

| 类型 | 约束 |
|---|---|
| CheckConstraint | event end_at > start_at；plan daily_minutes 60-720 |
| 业务校验（写入层） | 同用户单 active plan；exam_date >= tomorrow；recurring_rule 必须能被 rrule.js 解析；BYHOUR/SECONDLY/YEARLY 拒绝 |
| FK on_delete | plan→user CASCADE；event→plan CASCADE；session.linked_*→event/recommendation SET NULL |
| 默认值 | dashboard_preferences = `{section_a_visible:true,...}`（DB level default 用 JSON literal） |
| 时区 | DB 列存 UTC datetime（无 tz info）；API 层一律 ISO with offset；timezone 字段单独存 IANA 名 |

---

## 10. 引用矩阵

| 本文档被引用 |
|---|
| `03-Backend-WU.md` 全文（WU-B1-B5 严格按本文 §2 / §8 实现） |
| `04-Frontend-WU.md` API 类型来自本文 §6 响应 shape |
| `05-LLM-Module.md` LlmCallV2 / IdempotencyKeyV2 |
| `09-Observability-Audit.md` AuditLogV2 / LlmCallV2 / change_log |
