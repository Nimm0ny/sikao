# Phase-Practice · 12 · Session Lifecycle

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Module**: `modules/session_lifecycle/`（新建，详见 [03-Backend-WU §20](./03-Backend-WU.md#20-wu-b26-session_lifecycle-模块新建)）
> **决策来源**：`00-Decisions.md` Session-LC-* 系列
> **与既有 session 模块的关系**：本模块**不替代** `modules/session/`，而是为 session 添加完整状态机管理（暂停 / 恢复 / 心跳 / 超时回收）。原 `modules/session/` 继续负责创建 / 作答 / 提交核心闭环。

---

## 1. 模块定位

### 1.1 当前缺口

V2 现有 session 流程仅有 `in_progress → submitted` 两态，没有：

- **暂停 / 恢复**：用户中途暂停意图（区别于"切到别的 tab"）
- **心跳保活**：识别"打开了 session 但人离开了"
- **草稿管理**：用户配置好了但还没真正进入答题（如自定义刷题对话框已选好但还没点开始）
- **超时回收**：长时间无活动的 session 应自动 paused 或 abandoned，避免泄漏
- **active session 查询**：`/practice` 顶部"继续上次"按钮需要后端真值
- **多端竞争**：用户手机做一半到电脑继续，旧端怎么处理
- **异常恢复**：浏览器崩溃 / 断网后端如何识别上次状态

本模块把这些全部覆盖。

### 1.2 职责边界

| 模块 | 包含 | 不包含 |
|---|---|---|
| **session_lifecycle**（本模块） | 状态机定义 / pause / resume / heartbeat / discard / active query / 超时 cron | 答题创建（`session.create`）/ 答题写入（`session.answers`）/ 提交（`session.submit`）/ 时间事件（`timing` 模块） |
| `session` | 业务核心（CRUD answers / submit / 取出题逻辑） | 状态切换（仅在 submit 时调本模块） |
| `timing` | 时间事件 / 基线 | session 状态 |
| `mock_exam` | 模考全局倒计时 + 强制提交触发 | session 状态机本身 |

### 1.3 文件结构

```
services/api/src/sikao_api/modules/session_lifecycle/
  __init__.py
  application/
    state_machine.py            # 状态转换的纯函数（核心）
    pause_resume.py             # pause / resume 业务逻辑
    heartbeat.py                # heartbeat 接收 + 超时检测
    active_session_query.py     # "active session" 查询
    cleanup.py                  # 超时 / 异常 session 回收
    discard.py                  # 主动废弃
  domain/
    types.py                    # SessionStatus 枚举 / 转换图定义
    errors.py
  interface/
    routes.py
    schemas.py

services/api/src/sikao_api/cron/
  session_cleanup_cron.py       # 调度 cleanup.py
```

---

## 2. 状态机定义

### 2.1 状态枚举

```python
class SessionStatus(StrEnum):
    DRAFT = "draft"              # 已配置但未真正开始（首题未渲染）
    IN_PROGRESS = "in_progress"  # 进行中（默认状态）
    PAUSED = "paused"            # 用户主动暂停 / 心跳超时被动暂停
    SUBMITTED = "submitted"      # 已提交（终态）
    ABANDONED = "abandoned"      # 长时间无活动被回收（终态）
    EXPIRED = "expired"          # 已过期（如 daily 当日未完成）（终态）
```

### 2.2 状态转换图

```
                 ┌──────────────┐
       create →  │    DRAFT     │
                 └───┬──────────┘
                     │ user_first_answer / heartbeat_received
                     ↓
                 ┌──────────────────────────┐
        ┌─────── │      IN_PROGRESS         │ ───────┐
        │        └──┬───────────────────────┘        │
        │           │                                │
   user_pause       │ no_heartbeat_30min        user_submit
        │           │                                │
        ↓           ↓                                ↓
   ┌─────────┐  ┌──────────┐                  ┌──────────────┐
   │ PAUSED  │  │  PAUSED  │                  │  SUBMITTED   │ (终态)
   └────┬────┘  └────┬─────┘                  └──────────────┘
        │ user_resume                                ↑
        │ + heartbeat                                │
        └────────────┘                       force_submit (mock_exam)
                     │                                │
                     │ no_activity_24h                │
                     │                                │
                     ↓                                │
                ┌──────────────┐                      │
                │  ABANDONED   │ (终态)               │
                └──────────────┘                      │
                                                      │
                  daily session                       │
                  cron 当日 23:59 检查：              │
                  status != submitted 且 type=daily   │
                          ↓                           │
                  ┌──────────────┐                    │
                  │   EXPIRED    │ (终态)             │
                  └──────────────┘                    │
                                                      │
                  IN_PROGRESS 中的 mock_exam          │
                  到达 auto_submit_at                 │
                          └─────────────────────→     │
```

### 2.3 转换规则表

| from | to | trigger | 谁触发 | 同步动作 |
|---|---|---|---|---|
| (none) | DRAFT | session.create | 用户 / 系统 | last_activity_at = now |
| DRAFT | IN_PROGRESS | first_answer / first_heartbeat | 用户行为 | first_question_at = now |
| IN_PROGRESS | PAUSED | user_pause | 用户主动 | paused_at = now，写 audit |
| IN_PROGRESS | PAUSED | heartbeat_timeout | cron / heartbeat 检测 | paused_at = (last_heartbeat + 30min)，写 audit + metric |
| PAUSED | IN_PROGRESS | user_resume | 用户主动 | paused_total_seconds += (now - paused_at)，paused_at = null，写 audit |
| PAUSED | IN_PROGRESS | new_heartbeat | 前端心跳到达 | 同上 |
| IN_PROGRESS / PAUSED | SUBMITTED | user_submit | 用户主动（normal） | completed_at = now，触发批改 / stats hook |
| IN_PROGRESS / PAUSED | SUBMITTED | force_submit | mock_exam 倒计时 / 系统 | force_submitted = true，写 audit |
| IN_PROGRESS / PAUSED | ABANDONED | no_activity_24h | cron | reason = 'no_activity_24h'，写 audit |
| IN_PROGRESS / PAUSED | ABANDONED | user_discard | 用户主动废弃 | reason = 'user_discard'，写 audit |
| IN_PROGRESS / PAUSED | EXPIRED | daily_expire_cron | cron 当日 23:59 | 仅 type=daily 的 session |
| DRAFT | ABANDONED | no_activity_2h | cron | DRAFT 阈值短得多（2h） |
| 任何终态 | * | （禁止） | - | 422 IMMUTABLE_TERMINAL_STATE |

### 2.4 转换函数（纯函数）

```python
# state_machine.py
@dataclass(frozen=True)
class TransitionAttempt:
    from_status: SessionStatus
    trigger: str                # 见 §2.3 trigger 列
    actor: Literal["user", "system", "cron"]

class TransitionResult(NamedTuple):
    ok: bool
    new_status: SessionStatus | None
    error_code: str | None

# 单一职责：判定一次转换是否合法
def evaluate_transition(attempt: TransitionAttempt) -> TransitionResult: ...

# 调用方应 wrap 在 DB transaction 内 + assert_owner 校验
```

`evaluate_transition` 必须有完整 truth table 单测（每条规则一个 case + 终态自循环 + 跨状态非法）。

---

## 3. 数据模型

详见 [02-Data-Model §2.2 / §2.6](./02-Data-Model.md#22-practicesessionv2扩展)。本模块涉及：

```python
class PracticeSessionV2(Base):
    # ===== session_lifecycle 字段（本模块写入） =====
    status: Mapped[SessionStatus]
    # 详见 §2.1

    paused_at: Mapped[datetime | None]
    # 当前 paused 起始时刻（PAUSED → IN_PROGRESS 时清空）

    paused_count: Mapped[int] = mapped_column(default=0)
    # 累计暂停次数

    last_heartbeat_at: Mapped[datetime | None]
    # 最近一次心跳时刻（前端定期上报）

    expires_at: Mapped[datetime | None]
    # 主动失效时间（daily session 的当日 23:59 / 用户自定义最长会话时间）
    # null = 不主动失效

    abandoned_at: Mapped[datetime | None]
    # 进入 ABANDONED 的时刻

    abandoned_reason: Mapped[str | None] = mapped_column(String(64))
    # 'no_activity_24h' | 'user_discard' | 'no_activity_draft_2h'

    force_submitted: Mapped[bool] = mapped_column(default=False)
    # 是否系统强制提交（mock_exam 倒计时归零 / admin 强制 / cron 异常恢复时）

    force_submitted_reason: Mapped[str | None] = mapped_column(String(64))
    # 'mock_exam_timeout' | 'admin_action' | 'recovery_unknown'

    recovered_from_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("practice_session_v2.id"), nullable=True
    )
    # 如果该 session 是从异常 abandoned 的旧 session 恢复而来，指向旧 session
    # 用于异常恢复链审计；当前 V2 范围内默认不启用恢复克隆，留扩展位
```

---

## 4. 端点

### 4.1 用户主动操作

```
POST /api/v2/practice/sessions/:id/pause
→ 200 { status: "paused", paused_at: ISO }
→ 409 INVALID_TRANSITION 当前状态不允许 pause
→ 403 NOT_OWNED

POST /api/v2/practice/sessions/:id/resume
→ 200 { status: "in_progress", paused_total_seconds: int }
→ 409 INVALID_TRANSITION

POST /api/v2/practice/sessions/:id/heartbeat
body: { client_ts?: ISO, current_question_id?: int }
→ 200 { server_ts: ISO, status: SessionStatus }
（heartbeat 不抛错，对终态 session 仅返回当前状态不写入）

POST /api/v2/practice/sessions/:id/discard
body: { reason?: string }
→ 200 { status: "abandoned" }
→ 409 ALREADY_TERMINAL

POST /api/v2/practice/sessions/:id/start
（DRAFT → IN_PROGRESS 显式触发；用于自定义对话框配置完成后用户点"开始"
但首题尚未答的过渡场景）
→ 200 { status: "in_progress", first_question_at: ISO }
→ 409 INVALID_TRANSITION
```

### 4.2 查询端点

```
GET /api/v2/practice/sessions/active
→ 200 {
    sessions: [
      {
        id, type, mode, source_mode, practice_mode,
        status,                       // in_progress | paused | draft
        started_at, last_activity_at, paused_at,
        progress: { answered: 5, total: 10 },
        paper_code?, category?
      }
    ],
    count
  }

仅返回 status ∈ {in_progress, paused, draft} 的 session。
按 last_activity_at DESC 排序。limit=10。
```

```
GET /api/v2/practice/sessions/:id/lifecycle
→ 200 {
    status, paused_at, paused_count, last_heartbeat_at,
    expires_at, abandoned_at, abandoned_reason,
    force_submitted, force_submitted_reason,
    transitions: [   // audit 中提取的状态变迁链
      { from, to, trigger, actor, ts, reason? }
    ]
  }
```

### 4.3 admin 端点（仅 admin 可访问）

```
POST /admin/practice/sessions/:id/force-abandon
body: { reason: string }
→ 用于运维清理"卡住"的 session

POST /admin/practice/sessions/:id/force-submit
body: { reason: string }
→ 强制按当前 answer 提交（罕见运维场景）
```

---

## 5. 心跳机制

### 5.1 前端契约

| 触发条件 | 行为 |
|---|---|
| session 进入 IN_PROGRESS / PAUSED | 启动心跳定时器 |
| 间隔 | **每 30 秒**一次（统一，简化） |
| 用户切走 tab | 暂停心跳（visibilitychange listener） |
| 用户切回 tab | 立即发一次心跳 + 恢复定时器 |
| 网络失败 | 静默重试 1 次（5s 后），失败不报错（不打扰用户） |
| session 进入终态 | 停止心跳 |

⚠️ 心跳**不携带答题内容**，只更新 `last_heartbeat_at` + 可选 `current_question_id`（用于"继续上次"恢复定位）。答题数据由 timing 模块的事件上报负责。

### 5.2 后端处理

```python
async def receive_heartbeat(
    session_id: int,
    user_id: int,
    client_ts: datetime | None,
    current_question_id: int | None,
) -> HeartbeatResponse:
    session = await get_session(session_id, user_id)
    server_ts = datetime.utcnow()

    # 终态：仅返回状态，不写入
    if session.status in TERMINAL_STATUSES:
        return HeartbeatResponse(server_ts=server_ts, status=session.status)

    # PAUSED → IN_PROGRESS：心跳到达视为隐式 resume（决策 LC-3a）
    # 用户从 paused 状态发心跳（说明前端刷新了页面 / 切回了 tab），自动恢复
    # 客户端应在心跳响应中比对 status 字段决定是否切换 UI 状态（不需要二次手动 resume）
    if session.status == SessionStatus.PAUSED:
        await transition_to_in_progress(session, trigger='new_heartbeat')

    # DRAFT 不被心跳唤醒（决策 LC-2）：必须显式 POST /sessions/:id/start
    # 或第一次写 answer 隐式触发；heartbeat 仅记录 last_heartbeat_at 不切状态
    # （但 DRAFT session 通常用户都还在配置页，不会有客户端发心跳）

    session.last_heartbeat_at = server_ts
    if current_question_id:
        # 写到 metadata 而非新字段，避免 schema 膨胀
        session.config_snapshot['last_seen_question_id'] = current_question_id

    await db.commit()

    return HeartbeatResponse(server_ts=server_ts, status=session.status)
```

### 5.3 心跳超时检测

由 cron `cleanup_stale_sessions`（详见 §7.1）每 5 分钟扫描：

```sql
SELECT id FROM practice_session_v2
WHERE status = 'in_progress'
  AND last_heartbeat_at < NOW() - INTERVAL '30 minutes'
LIMIT 500;
```

命中行：
- IN_PROGRESS → PAUSED
- paused_at = last_heartbeat_at + 30min
- 写 audit `session.heartbeat_timeout_paused`

---

## 6. 草稿（DRAFT）

### 6.1 何时进入 DRAFT

`session.create` 接受可选参数 `as_draft: bool = False`：

- `as_draft=False`（默认）：直接创建为 IN_PROGRESS（兼容现有调用方）
- `as_draft=True`：创建为 DRAFT，配置好题目但用户尚未开始答题

DRAFT 用例：
- 自定义刷题对话框：用户选好配置→ 后端预生成 session（含选题结果）→ 用户决定是否开始
- AI 出题：等待页生成完成后 session 处于 DRAFT，用户点"开始"才转 IN_PROGRESS

### 6.2 DRAFT 的特殊规则

- 不接受 timing 事件（除 question_enter 第一次时隐式转 IN_PROGRESS）
- 心跳到达时**不**自动转（需要 `POST /sessions/:id/start` 显式转）
- 2h 无活动 → ABANDONED（reason=`no_activity_draft_2h`）（区别于 IN_PROGRESS 的 24h）

### 6.3 DRAFT → IN_PROGRESS 转换

```
显式：POST /sessions/:id/start
隐式：第一次写 answer（session.commit_answer 时 session_lifecycle 模块返回 transition）
```

---

## 7. Cron：超时回收

### 7.1 cleanup_stale_sessions（每 5 分钟）

```python
async def cleanup_stale_sessions():
    now = datetime.utcnow()

    # Stage 1: IN_PROGRESS 心跳超时 30min → PAUSED
    in_progress_to_paused = await db.execute(
        select(PracticeSessionV2)
        .where(PracticeSessionV2.status == SessionStatus.IN_PROGRESS)
        .where(PracticeSessionV2.last_heartbeat_at < now - timedelta(minutes=30))
        .limit(500)
    ).scalars().all()
    for s in in_progress_to_paused:
        await transition_in_session(s, to=SessionStatus.PAUSED, trigger='heartbeat_timeout', actor='cron')

    # Stage 2: PAUSED 24h 无任何活动 → ABANDONED
    paused_to_abandoned = await db.execute(
        select(PracticeSessionV2)
        .where(PracticeSessionV2.status == SessionStatus.PAUSED)
        .where(
            or_(
                PracticeSessionV2.last_heartbeat_at < now - timedelta(hours=24),
                PracticeSessionV2.paused_at < now - timedelta(hours=24),
            )
        )
        .limit(500)
    ).scalars().all()
    for s in paused_to_abandoned:
        await transition_in_session(
            s, to=SessionStatus.ABANDONED,
            trigger='no_activity_24h', actor='cron',
            extra={'abandoned_reason': 'no_activity_24h'},
        )

    # Stage 3: DRAFT 2h 无活动 → ABANDONED
    draft_to_abandoned = await db.execute(
        select(PracticeSessionV2)
        .where(PracticeSessionV2.status == SessionStatus.DRAFT)
        .where(PracticeSessionV2.created_at < now - timedelta(hours=2))
        .limit(500)
    ).scalars().all()
    for s in draft_to_abandoned:
        await transition_in_session(
            s, to=SessionStatus.ABANDONED,
            trigger='no_activity_draft_2h', actor='cron',
            extra={'abandoned_reason': 'no_activity_draft_2h'},
        )

    await audit_log.write(
        actor='system',
        action='session.cleanup_run',
        target_type='PracticeSessionV2',
        reason=f'paused={len(in_progress_to_paused)}, abandoned={len(paused_to_abandoned) + len(draft_to_abandoned)}',
    )
```

### 7.2 expire_daily_sessions（每日 23:55）

```python
async def expire_daily_sessions():
    now = datetime.utcnow()
    today_end = end_of_day_utc(now)

    candidates = await db.execute(
        select(PracticeSessionV2)
        .join(DailyPracticeV2, DailyPracticeV2.completed_session_id == PracticeSessionV2.id)
        .where(PracticeSessionV2.source_mode == SessionSourceMode.DAILY)
        .where(PracticeSessionV2.status.in_([SessionStatus.IN_PROGRESS, SessionStatus.PAUSED, SessionStatus.DRAFT]))
        .where(PracticeSessionV2.expires_at <= today_end)
    ).scalars().all()

    for s in candidates:
        await transition_in_session(s, to=SessionStatus.EXPIRED, trigger='daily_expire_cron', actor='cron')
```

### 7.3 cron 失败兜底

- cleanup 失败不影响用户使用：用户主动 pause / resume / submit 端点不依赖 cron
- 失败时 audit + alert，但下次 cron 会重试同样的 session（幂等）

---

## 8. 多端竞争策略

### 8.1 场景

用户在手机上做了一半 → session.status=IN_PROGRESS 但是手机切走（30min 心跳超时）→ session.status=PAUSED → 用户在电脑打开"继续上次" → 电脑恢复后 session.status=IN_PROGRESS。此时如果手机又切回来：

### 8.2 策略：last-writer-wins + heartbeat 标识

V2 当前阶段（单用户单设备主流场景）采用：

- 不做严格的"独占锁"
- 心跳 / 答题写入仅校验 user_id 所有权，不校验设备
- 后到的写入覆盖前面的（按 server_ts 有序）
- 客户端在心跳响应中如果发现 `status` 与本地不一致，立即 refetch 最新 session 状态

**不在本 Phase 范围**：跨设备实时冲突提示 / 二次确认。

### 8.3 隐式约束

- 同一 user 同一时刻可以有多个 IN_PROGRESS session（不强制最多一个）
- 但 daily session 受 UNIQUE(user_id, date, type) 约束保护
- 自定义刷题与 AI 出题不限制并发数

---

## 9. 与其他模块的集成

### 9.1 session.create

```python
# 修改 session.create 调用 session_lifecycle 决定初始状态
async def create_session(*, as_draft: bool = False, ...) -> Session:
    initial_status = SessionStatus.DRAFT if as_draft else SessionStatus.IN_PROGRESS
    ...
    session = PracticeSessionV2(
        status=initial_status,
        last_activity_at=now,
        last_heartbeat_at=now if not as_draft else None,
        ...
    )
```

### 9.2 session.commit_answer / submit

```python
async def commit_answer(session_id: int, ...):
    session = await get_session(session_id)
    # 答题写入要求 status ∈ {DRAFT, IN_PROGRESS, PAUSED}
    if session.status in TERMINAL_STATUSES:
        raise ServiceError(code='SESSION_NOT_WRITABLE', http=409)
    if session.status == SessionStatus.DRAFT:
        # 隐式转 IN_PROGRESS
        await session_lifecycle.transition(session, to=IN_PROGRESS, trigger='first_answer')
    if session.status == SessionStatus.PAUSED:
        # 答题等同于隐式 resume
        await session_lifecycle.transition(session, to=IN_PROGRESS, trigger='answer_during_paused')
    # ... 实际写 answer
```

```python
async def submit_session(session_id: int, ...):
    session = await get_session(session_id)
    if session.status in (SessionStatus.SUBMITTED, SessionStatus.ABANDONED, SessionStatus.EXPIRED):
        raise ServiceError(code='IMMUTABLE_TERMINAL_STATE', http=422)
    await session_lifecycle.transition(session, to=SUBMITTED, trigger='user_submit', actor='user')
    # ... 触发批改 / stats hook
```

### 9.3 timing.record_events

详见 [11-Timing-Engine §3.4](./11-Timing-Engine.md#34-服务端处理)。timing 端点要求 status ∈ {IN_PROGRESS, PAUSED}；DRAFT 拒绝写入。

### 9.4 mock_exam.force_submit

详见 [13-Mock-Exam §5](./13-Mock-Exam.md)。mock_exam 倒计时归零时调本模块：

```python
await session_lifecycle.transition(
    session, to=SUBMITTED,
    trigger='force_submit', actor='system',
    extra={'force_submitted': True, 'force_submitted_reason': 'mock_exam_timeout'},
)
# 然后调 session.submit 完成业务收尾
```

---

## 10. Invariant

详见 [01-Boundary-Rules §13](./01-Boundary-Rules.md#13-session-生命周期边界session-lc-) 与 [10-Testing §3.8](./10-Testing.md#38-session-lifecycle-invariant)。

| Invariant | 描述 |
|---|---|
| **Session-LC-Status-Closed** | 任何 status 转换都必须经过 `evaluate_transition`；DB 层加 CHECK enum 约束 |
| **Session-LC-Terminal-Immutable** | SUBMITTED / ABANDONED / EXPIRED 不可再变（含 status / answer / config 任何字段） |
| **Session-LC-Terminal-Writes-Forbidden** | 终态 session 拒绝任何 mutation 端点（answer / pause / resume / discard）→ 422 IMMUTABLE_TERMINAL_STATE |
| **Session-LC-Resume-Adds-Pause-Time** | resume 时必须把 (now - paused_at) 累加到 paused_total_seconds，paused_at 清空 |
| **Session-LC-Pause-Single-Active** | paused_at 非空 ⟺ status=PAUSED；status=IN_PROGRESS 时 paused_at 必为 null |
| **Session-LC-Heartbeat-No-Terminal** | 心跳到达终态 session：仅返回当前状态，不写 last_heartbeat_at |
| **Session-LC-Heartbeat-Wakes-Paused** | 心跳到达 PAUSED session：隐式 resume（trigger='new_heartbeat'）；累加 paused_total_seconds 并清空 paused_at（决策 LC-3a） |
| **Session-LC-Heartbeat-No-Draft-Wake** | 心跳到达 DRAFT session：仅记录 last_heartbeat_at，**不**转 IN_PROGRESS（决策 LC-2） |
| **Session-LC-Force-Submit-Audit** | force_submitted=true 必有 audit log + force_submitted_reason 非空 |
| **Session-LC-Daily-Expire-Type** | EXPIRED 状态仅可能出现在 source_mode=daily 的 session 上 |
| **Session-LC-Draft-No-Answers** | DRAFT 状态的 session 不应有 PracticeSessionAnswerV2.selected_answer 非空 |
| **Session-LC-Recovery-Chain** | recovered_from_session_id 指向的 session 必须 status=ABANDONED |

---

## 11. 性能预算

| 端点 | p50 | p95 | p99 |
|---|---|---|---|
| POST /sessions/:id/heartbeat | 30ms | 80ms | 150ms |
| POST /sessions/:id/pause | 50ms | 120ms | 250ms |
| POST /sessions/:id/resume | 50ms | 120ms | 250ms |
| POST /sessions/:id/discard | 50ms | 120ms | 250ms |
| GET /sessions/active | 80ms | 200ms | 400ms |
| GET /sessions/:id/lifecycle | 100ms | 250ms | 500ms |

cron `cleanup_stale_sessions`：
- 单次扫描规模 500 行 / 类型 → 完成 < 30s
- 5 分钟间隔，单实例足够

---

## 12. 限流

| 端点 | 限流 |
|---|---|
| `POST /sessions/:id/heartbeat` | 每用户每 session **5 req/min**（保护 DB；正常前端 30s 一次远低于此） |
| `POST /sessions/:id/pause` | 每用户 30 req/min |
| `POST /sessions/:id/resume` | 每用户 30 req/min |
| `POST /sessions/:id/discard` | 每用户 10 req/min |
| `GET /sessions/active` | 每用户 60 req/min |

---

## 13. 审计与可观测

### 13.1 audit 触发

| 事件 | actor | 备注 |
|---|---|---|
| `session.transition` | user/cron/system | before={status, paused_at}, after={status, paused_at}, reason=trigger |
| `session.heartbeat_timeout_paused` | system | cron 触发 |
| `session.no_activity_abandoned` | system | cron 触发 |
| `session.force_submitted` | system | mock_exam timeout / admin / recovery |
| `session.user_discarded` | user | 用户主动废弃 |
| `session.admin_force_action` | admin | admin 端点 |
| `session.draft_abandoned` | system | 2h 无活动 |
| `session.daily_expired` | system | cron |

### 13.2 metrics

```
session.transition_total{from, to, trigger}
session.heartbeat_received_total
session.heartbeat_rejected_total{reason}
session.cleanup.in_progress_to_paused_total
session.cleanup.paused_to_abandoned_total
session.cleanup.draft_to_abandoned_total
session.daily_expired_total
session.force_submit_total{reason}
session.user_discard_total
session.active_count{status}                 # gauge
session.heartbeat_latency_seconds            # histogram
```

---

## 14. 错误处理矩阵

| 场景 | 响应 | 前端行为 |
|---|---|---|
| 转换非法（如 SUBMITTED → IN_PROGRESS） | 409 INVALID_TRANSITION | toast 报错 + refetch 最新状态 |
| 终态 session 调 mutation 端点 | 422 IMMUTABLE_TERMINAL_STATE | toast + 引导回 result 页 |
| heartbeat 失败 | 静默重试 / 5xx 不打扰用户 | 前端不显示错误 |
| pause/resume 网络失败 | toast + 本地状态保留 | 用户重试 |
| active session 列表为空 | 200 + count=0 | 不显示"继续上次" |
| 同一用户在多端发 pause | last-writer-wins | 不报错 |

---

## 15. 与 daily_practice 的协同

`DailyPracticeV2` 表通过 `completed_session_id` 关联 session。状态对齐策略：

| DailyPracticeV2.status | 关联 session.status |
|---|---|
| pending | session 未创建 |
| started | session.status ∈ {IN_PROGRESS, PAUSED, DRAFT} |
| completed | session.status = SUBMITTED |
| expired | session.status = EXPIRED |

Daily expire cron（§7.2）同步设置 `DailyPracticeV2.status = expired`。

---

## 16. 关联文档

- [00-Decisions §15](./00-Decisions.md#15-session-生命周期session-lc-系列) - Session-LC-* 决策
- [01-Boundary-Rules §13](./01-Boundary-Rules.md#13-session-生命周期边界session-lc-) - Session-LC-* invariant
- [02-Data-Model §2.2](./02-Data-Model.md#22-practicesessionv2扩展) - schema
- [03-Backend-WU §20](./03-Backend-WU.md#20-wu-b26-session_lifecycle-模块新建) - WU-B26 PR 拆分
- [04-Frontend-WU §13](./04-Frontend-WU.md#13-wu-f20-session-lifecycle-与-active-session) - 前端集成
- [11-Timing-Engine §3.4 / §6.3](./11-Timing-Engine.md) - 与 timing 协同
- [13-Mock-Exam §5](./13-Mock-Exam.md) - force_submit 触发
