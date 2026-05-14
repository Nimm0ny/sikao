---
type: architecture
status: draft
owner: lhr
last-reviewed: 2026-05-13
---

# Auth

## 范畴

身份认证 v2（new_web Identity v2）：邮箱 / 手机 / username_legacy。

## 主链路

```
注册 / 登录
  → POST /api/v2/auth/register-email | register-phone | login
  → 响应 httpOnly JWT cookie + CSRF token
绑定
  → POST /api/v2/auth/bind-email | bind-phone
密码恢复
  → POST /api/v2/auth/send-reset-code → confirm-reset → reset-password
邮箱验证
  → /verify-email?token=... 前端入口 → POST /api/v2/auth/verify-email
```

## 90 天过渡期

老 user 只有 `username_legacy`，没有 email/phone 的会被前端 RedirectGuard 强制走 `/complete-profile`。

## 后端 module

`services/api/src/sikao_api/modules/auth/`

- domain：User / AuthToken / PreRegisterCode
- application：login / register / bind / reset / verify 用例
- infrastructure：cookie / CSRF / JWT 编解码
- interface：路由 + DTO

## 前端 domain

- `packages/domain/src/auth/`（useAuthStore + auth hooks）
- `apps/web/src/views/auth/*`（页面）
- `apps/web/src/components/auth/RedirectGuard.tsx`

## CSRF + silent-refresh

`@sikao/api-client` 内部处理 401 silent refresh + CSRF header 注入。

## 状态

`not_started`，P0 优先迁移。
