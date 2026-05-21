# Phase-Profile · 06 · Testing Strategy

> **Status**: DRAFT
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`

---

## 1. 测试分层

| 层 | 覆盖 | 工具 |
|---|---|---|
| Unit | Service 方法逻辑 | pytest + SQLAlchemy in-memory |
| Integration | Route handler + DB + Auth | pytest + TestClient + fixture DB |
| Invariant | 注销后登录阻断、CASCADE 完整性 | pytest marker `@invariant` |
| E2E（前端后做） | 注销 UX 流程 | Playwright（后续） |

---

## 2. 关键测试用例

### 2.1 Settings

| Case | 期望 |
|---|---|
| GET /settings — 首次访问（无 ProfileInfoV2） | 返回 defaults: `ai_adjust_enabled=true` |
| PUT /settings — 关闭 AI | `ai_adjust_enabled=false` 持久化 |
| PUT /settings — 无 CSRF | 403 |

### 2.2 Preferences

| Case | 期望 |
|---|---|
| GET /preferences — 首次访问 | 返回 `{}` 空 dict |
| PUT /preferences — 更新 | 持久化完整 JSON |
| PUT /preferences — 超大 payload (>10KB) | 422 拒绝 |

### 2.3 Account Deletion

| Case | 期望 |
|---|---|
| DELETE /account — 正常注销 | user.deleted_at 非空, is_active=false, sessions revoked, job created |
| DELETE /account — 重复注销 | 409 conflict |
| DELETE /account — confirmation 不匹配 | 422 |
| 注销后 GET /profile/overview | 403 account_deleted |
| 注销后 POST /api/v2/auth/login | 403 account_deleted |

### 2.4 Bind Phone Stub

| Case | 期望 |
|---|---|
| POST /bind-phone | 501 Not Implemented |
| POST /bind-phone — 手机号格式错 | 422 validation error |

### 2.5 Cron Hard-Delete（mock）

| Case | 期望 |
|---|---|
| Job pending + hard_delete_at 已过 | user 被硬删, job.status=completed |
| Job pending + hard_delete_at 未到 | 不处理 |
| Job 硬删失败 | job.status=failed, error_message 记录 |

---

## 3. Invariant Tests

```python
# tests/invariants/test_profile_deletion.py

@invariant
def test_deleted_user_cannot_authenticate():
    """Del-2: 注销后认证层必须拒绝"""
    ...

@invariant
def test_hard_delete_cascades_all_user_data():
    """Del-3: 硬删后用户相关表无残留数据"""
    ...

@invariant
def test_audit_log_preserved_after_hard_delete():
    """Del-3: 审计日志保留（脱敏）"""
    ...
```

---

## 4. 关联文档

- [02-Backend-WU.md](./02-Backend-WU.md)（PR 拆分 = 测试拆分）
- [../Home/10-Testing.md](../Home/10-Testing.md)（格式参考）
