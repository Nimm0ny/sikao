# Phase-Profile · 02 · Backend Work Units

> **Status**: DRAFT
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Convention**: 每 PR ≤15 文件 / ≤400 行（AGENTS H9）

---

## 1. 端点总览

### 1.1 已有（Phase-Home 已落地）

| Method | Path | 用途 | Service 方法 |
|---|---|---|---|
| GET | `/api/v2/profile/overview` | 概览 | `build_overview` |
| GET | `/api/v2/profile/security` | 安全状态 | `get_security` |
| PUT | `/api/v2/profile/security` | 改密 | `update_security` |
| GET | `/api/v2/profile/goals` | 目标 | `get_goals` |
| PUT | `/api/v2/profile/goals` | 改目标 | `update_goals` |
| GET | `/api/v2/profile/info` | 个人信息 | `get_info` |
| PUT | `/api/v2/profile/info` | 改信息 | `update_info` |

### 1.2 新增（Phase-Profile MVP）

| Method | Path | 用途 | Service 方法 | 优先级 |
|---|---|---|---|---|
| GET | `/api/v2/profile/settings` | AI 开关 + 隐私 | `get_settings` | P0 |
| PUT | `/api/v2/profile/settings` | 更新 AI 开关 | `update_settings` | P0 |
| GET | `/api/v2/profile/preferences` | dashboard 偏好 | `get_preferences` | P0 |
| PUT | `/api/v2/profile/preferences` | 更新偏好（占位） | `update_preferences` | P0 |
| DELETE | `/api/v2/profile/account` | 注销（软删） | `request_deletion` | P0 |
| POST | `/api/v2/profile/bind-phone` | 绑定手机 stub | `bind_phone_stub` | P1（stub） |

---

## 2. PR 拆分计划

### PR-P1：Settings endpoint（GET + PUT）

**范围**：
- `schemas_v2.py`：新增 `ProfileSettingsResponseV2` + `ProfileSettingsUpdateRequestV2`
- `service.py`：新增 `get_settings()` + `update_settings()`
- `routes.py`：新增 2 个 route handler
- 测试：unit test for service + integration test for routes

**实现逻辑**：
```python
def get_settings(self, *, user: UserV2) -> ProfileSettingsResponseV2:
    info = self._get_or_create_info(user)
    return ProfileSettingsResponseV2(
        ai_adjust_enabled=info.ai_adjust_enabled,
        llm_enabled=info.ai_adjust_enabled,
    )

def update_settings(self, *, user: UserV2, payload: ProfileSettingsUpdateRequestV2) -> ProfileSettingsResponseV2:
    info = self._get_or_create_info(user)
    info.ai_adjust_enabled = payload.ai_adjust_enabled
    self.session.add(info)
    return self.get_settings(user=user)
```

**文件变更**：~4 文件 / ~80 行

---

### PR-P2：Preferences endpoint（GET + PUT）

**范围**：
- `schemas_v2.py`：新增 `ProfilePreferencesResponseV2` + `ProfilePreferencesUpdateRequestV2`
- `service.py`：新增 `get_preferences()` + `update_preferences()`
- `routes.py`：新增 2 个 route handler
- 测试

**实现逻辑**：
```python
def get_preferences(self, *, user: UserV2) -> ProfilePreferencesResponseV2:
    info = self._get_or_create_info(user)
    return ProfilePreferencesResponseV2(
        dashboard_preferences=info.dashboard_preferences,
    )

def update_preferences(self, *, user: UserV2, payload: ProfilePreferencesUpdateRequestV2) -> ProfilePreferencesResponseV2:
    info = self._get_or_create_info(user)
    info.dashboard_preferences = payload.dashboard_preferences
    self.session.add(info)
    return self.get_preferences(user=user)
```

**文件变更**：~4 文件 / ~80 行

---

### PR-P3：Account Deletion endpoint + Migration

**范围**：
- `models_v2.py`：`UserV2` 新增 `deleted_at` + `deletion_reason` 字段；新建 `AccountDeletionJobV2` class
- `schemas_v2.py`：新增 `AccountDeletionRequestV2` + `AccountDeletionResponseV2` + `DeletionReason` enum
- `service.py`：新增 `request_deletion()`
- `routes.py`：新增 DELETE handler
- Alembic migration：1 个文件
- 测试

**实现逻辑**：
```python
def request_deletion(self, *, user: UserV2, payload: AccountDeletionRequestV2) -> AccountDeletionResponseV2:
    if user.deleted_at is not None:
        raise ConflictError("account already scheduled for deletion")

    now = utc_now()
    hard_delete_at = now + timedelta(days=7)

    user.deleted_at = now
    user.deletion_reason = payload.reason.value
    user.is_active = False
    self.session.add(user)

    job = AccountDeletionJobV2(
        user_id=user.id,
        requested_at=now,
        hard_delete_at=hard_delete_at,
        status="pending",
        reason=payload.reason.value,
    )
    self.session.add(job)

    # Revoke all active sessions
    self.session.execute(
        update(AuthSessionV2)
        .where(AuthSessionV2.user_id == user.id, AuthSessionV2.revoked_at.is_(None))
        .values(revoked_at=now)
    )

    return AccountDeletionResponseV2(
        message="账号已注销，将在 7 天后永久删除。",
        hard_delete_at=hard_delete_at,
    )
```

**认证层变更**：
- `security_v2.py` 的 `get_current_user_v2` 中追加检查：
  ```python
  if user.deleted_at is not None:
      raise ForbiddenError("account has been deactivated", code="account_deleted")
  ```

**文件变更**：~7 文件 / ~200 行

---

### PR-P4：Bind Phone stub

**范围**：
- `schemas_v2.py`：新增 `BindPhoneRequestV2` + `BindPhoneResponseV2`
- `service.py`：新增 `bind_phone_stub()` → 直接抛 501
- `routes.py`：新增 POST handler
- 测试（验证返回 501）

**实现逻辑**：
```python
def bind_phone_stub(self, *, user: UserV2, payload: BindPhoneRequestV2) -> None:
    raise NotImplementedError("bind-phone not yet implemented")
```

Route handler catch `NotImplementedError` → 返回 501 + `{"detail": "bind-phone not yet implemented"}`

**文件变更**：~4 文件 / ~50 行

---

### PR-P5：Hard-delete cron worker（已实现）

**范围**：
- `modules/profile_v2/application/deletion_worker.py`：`run_hard_delete_sweep(session) -> int`
- 测试：`tests/test_profile_deletion_worker.py`（v2-#1 FK SET NULL 审计保留 + v2-#2 异常 rollback 隔离）

**实现要点**：
- 同步函数（SQLAlchemy `Session`），逐个 job try-commit，单个 job 异常仅 rollback + 标 `failed` + 写 `error_message`，loop 不退出。
- `AccountDeletionJobV2.user_id ondelete=SET NULL`：硬删 user 后 job 行作为审计记录长存，`user_public_id` 保留。

---

### PR-P6：Cron 调度接入（lifespan + asyncio）

**范围**：
- `core/scheduler.py`：`DeletionSweepScheduler` 类（start / stop / 后台 task loop）
- `core/config.py`：4 个新 Settings 字段
- `main.py`：在 `lifespan` 启动 scheduler、关闭时优雅 cancel
- 测试：`tests/test_profile_deletion_scheduler.py`（startup/shutdown、周期触发、worker 异常吞掉）

**调度选型（D-P11）**：
- ✅ **FastAPI lifespan + `asyncio.create_task` + `asyncio.to_thread`**（同 limiter 模式）
- ❌ APScheduler：不引新依赖；调度需求单一（一个 sweep 任务）；APScheduler 在 multi-uvicorn-worker 下要 Redis jobstore 协调，复杂度反超自实现
- ❌ 外部 cron / k8s CronJob：违反「starts with FastAPI 启动周期」需求；也增加运维 surface

**实现骨架**：
```python
class DeletionSweepScheduler:
    def __init__(self, db, *, interval_seconds, initial_delay_seconds,
                 run_on_startup, sweep_fn=run_hard_delete_sweep):
        self._db = db
        self._interval = interval_seconds
        self._initial_delay = initial_delay_seconds
        self._run_on_startup = run_on_startup
        self._sweep_fn = sweep_fn
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run_loop(), name="deletion-sweep")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task

    async def _run_loop(self) -> None:
        try:
            if not self._run_on_startup:
                await self._sleep(self._initial_delay)
            while not self._stop.is_set():
                await self._run_once_safely()
                await self._sleep(self._interval)
        except asyncio.CancelledError:
            raise

    async def _run_once_safely(self) -> int:
        try:
            return await asyncio.to_thread(self._sweep_in_session)
        except Exception as exc:  # 吞所有异常防 task 退出
            logger.exception("deletion_sweep.error err=%s", exc)
            return 0

    def _sweep_in_session(self) -> int:
        session = self._db.session_factory()
        try:
            return self._sweep_fn(session)
        finally:
            session.close()

    async def _sleep(self, seconds: float) -> None:
        # 用 wait + timeout 让 stop() 能立即唤醒
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=seconds)
        except asyncio.TimeoutError:
            pass
```

**Settings 新字段**：
| 字段 | 默认 | 说明 |
|---|---|---|
| `deletion_sweep_enabled` | `False` | 总开关；pytest / dev 默认关 |
| `deletion_sweep_interval_seconds` | `86400` | 每 24h 跑一次 |
| `deletion_sweep_initial_delay_seconds` | `60` | 启动后等 60s 才首次跑（防 startup 抖动） |
| `deletion_sweep_run_on_startup` | `False` | 启动立即跑一次（运维兜底） |

**多 worker 警告**：`run_hard_delete_sweep` 已基本幂等（`status='pending'` filter）但有竞态。MVP 部署文档要求：仅 leader worker 设置 `DELETION_SWEEP_ENABLED=true`，其它 worker 保持默认关闭；或单独跑一个 worker 进程（如 `uvicorn --workers 1 ... + DELETION_SWEEP_ENABLED=true`）。

**文件变更**：~5 文件 / ~250 行（含测试）

---

## 3. PR 依赖图

```
PR-P1 (Settings) ──┐
                   ├─ 无依赖，可并行
PR-P2 (Preferences)┘

PR-P3 (Deletion) ──── 独立（migration 先跑）

PR-P4 (Bind stub) ── 独立

PR-P5 (Cron worker) ── 依赖 PR-P3（需要 AccountDeletionJobV2 存在）

PR-P6 (Scheduler 接入) ── 依赖 PR-P5（worker 函数签名稳定）
```

---

## 4. 认证层影响

| 变更 | 位置 | 触发条件 |
|---|---|---|
| 注销用户登录阻断 | `modules/identity/application/security_v2.py` | `user.deleted_at IS NOT NULL` → 403 |
| Session 全部撤销 | `request_deletion()` 内执行 | 注销请求时立即执行 |

---

## 5. 接口规格

### 5.1 DELETE `/api/v2/profile/account`

**Request**：
```json
{
  "reason": "not_useful",
  "confirmation": "确认注销"
}
```

**Response 200**：
```json
{
  "message": "账号已注销，将在 7 天后永久删除。",
  "hardDeleteAt": "2026-05-28T10:30:00Z"
}
```

**Error 409**：
```json
{
  "detail": "account already scheduled for deletion",
  "code": "already_deleting"
}
```

### 5.2 GET `/api/v2/profile/settings`

**Response 200**：
```json
{
  "aiAdjustEnabled": true,
  "llmEnabled": true
}
```

### 5.3 PUT `/api/v2/profile/settings`

**Request**：
```json
{
  "aiAdjustEnabled": false
}
```

**Response 200**：同 GET response。

### 5.4 GET `/api/v2/profile/preferences`

**Response 200**：
```json
{
  "dashboardPreferences": {
    "sectionAVisible": true,
    "sectionBVisible": true,
    "sectionCVisible": true,
    "sectionOrder": ["a", "b", "c"],
    "calendarDefaultView": "today"
  }
}
```

### 5.5 PUT `/api/v2/profile/preferences`

**Request**：
```json
{
  "dashboardPreferences": {
    "sectionAVisible": true,
    "sectionBVisible": false,
    "sectionCVisible": true,
    "sectionOrder": ["a", "c", "b"],
    "calendarDefaultView": "week"
  }
}
```

**Response 200**：同 GET response。

### 5.6 POST `/api/v2/profile/bind-phone`

**Request**：
```json
{
  "phone": "13812341234",
  "verificationCode": "123456"
}
```

**Response 501**：
```json
{
  "detail": "bind-phone not yet implemented"
}
```

---

## 6. 关联文档

- [00-Decisions.md](./00-Decisions.md)
- [01-Data-Model.md](./01-Data-Model.md)
- [../Home/03-Backend-WU.md](../Home/03-Backend-WU.md)（格式参考）
