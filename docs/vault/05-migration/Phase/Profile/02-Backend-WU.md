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

### PR-P5：Hard-delete cron job（占位设计）

**范围**：
- `modules/profile_v2/application/deletion_worker.py`：cron handler 占位
- 测试（mock 验证调用链）

**实现逻辑（占位）**：
```python
async def run_hard_delete_cron():
    """
    每日 02:00 UTC+8 运行。

    1. 查 AccountDeletionJobV2 WHERE status='pending' AND hard_delete_at <= now()
    2. 对每个 job:
       a. 脱敏审计日志（AuditLogV2 actor → "deleted_user:<public_id>"）
       b. LlmCallV2.user_id → null
       c. DELETE FROM users_v2 WHERE id = job.user_id（CASCADE 清理全部）
       d. job.status = 'completed', job.completed_at = now()
    3. 失败的 job: status = 'failed', error_message = str(e)
    """
    pass  # TODO: implement when scheduling infra is ready
```

**文件变更**：~2 文件 / ~60 行

---

## 3. PR 依赖图

```
PR-P1 (Settings) ──┐
                   ├─ 无依赖，可并行
PR-P2 (Preferences)┘

PR-P3 (Deletion) ──── 独立（migration 先跑）

PR-P4 (Bind stub) ── 独立

PR-P5 (Cron 占位) ── 依赖 PR-P3（需要 AccountDeletionJobV2 存在）
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
