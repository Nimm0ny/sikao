# Phase-Profile · 05 · Privacy & Export

> **Status**: PARTIAL（仅注销部分纳入 MVP；数据导出推迟）
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`

---

## 1. 注销流程（MVP 纳入）

详见 [01-Data-Model.md](./01-Data-Model.md) §3 和 [02-Backend-WU.md](./02-Backend-WU.md) PR-P3。

### 1.1 时序图

```
User                     Frontend                  Backend                   Cron
 │                          │                         │                        │
 ├─ 点击"注销账号" ─────────→│                         │                        │
 │                          ├─ 弹出确认 dialog ──→    │                        │
 │  输入"确认注销" + 选原因 ─→│                         │                        │
 │                          ├─ DELETE /profile/account→│                        │
 │                          │                         ├─ user.deleted_at=now   │
 │                          │                         ├─ user.is_active=false  │
 │                          │                         ├─ revoke all sessions   │
 │                          │                         ├─ create DeletionJob    │
 │                          │                         │  (hard_delete_at=+7d)  │
 │                          │←── 200 {message, date} ─┤                        │
 │                          ├─ clear local session    │                        │
 │                          ├─ redirect /login ───→   │                        │
 │                          │                         │                        │
 │                          │          (7 days pass)  │                        │
 │                          │                         │                        │
 │                          │                         │  ←── cron 02:00 ───────┤
 │                          │                         │  scan pending jobs     │
 │                          │                         │  WHERE hard_delete_at  │
 │                          │                         │        <= now()        │
 │                          │                         ├─ anonymize audit logs  │
 │                          │                         ├─ nullify LlmCall.user  │
 │                          │                         ├─ DELETE user (CASCADE) │
 │                          │                         ├─ job.status=completed  │
```

### 1.2 安全约束

- 注销前必须验证当前密码（如果已设密码）— 后续迭代可加
- MVP 阶段：仅要求输入"确认注销"文字 + 选择原因（简化）
- CSRF token 必须（`verify_csrf_v2` 依赖）

---

## 2. 数据导出（推迟）

> **Decision**: D-P5 — Phase-Profile MVP 不做

### 2.1 后续设计预留

当实现时：
- 新增 `DataExportJobV2` 表（类似 DeletionJob 结构）
- 用户发起导出 → 异步生成 JSON/ZIP → 存 OSS → 邮件/短信通知下载链接
- 下载链接有效期 72h
- 导出范围：全量用户数据（profile + goals + sessions + notes + plans + events）

---

## 3. 关联决策

- [00-Decisions.md](./00-Decisions.md) Del-1~4, D-P5
- [01-Data-Model.md](./01-Data-Model.md) §3 AccountDeletionJobV2
- [02-Backend-WU.md](./02-Backend-WU.md) PR-P3, PR-P5
