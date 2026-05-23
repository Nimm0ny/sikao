# Phase · Auth（鉴权层）

> **Status**: TBD（占位）
> **IA 位置**：② Auth Layer（位于 Marketing 与 Gate 之间）
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-21

---

## 0. 范围预览

鉴权层覆盖：

- 登录（密码 / 短信验证码 / 第三方）
- 注册（邮箱 / 手机）
- 找回密码 / 重置密码
- session 管理（cookie / refresh / 多端登录）
- 安全策略（登录失败锁定 / 异地登录提醒 / 设备管理）
- 与 Gate 的衔接（登录后跳 OnboardingGate）

---

## 1. 启动前置

- ✅ 现有 auth 模块基础（Stage 1 单机已可用）
- ⏳ 第三方登录决策（微信 / 钉钉 / 飞书 / Apple，国内合规）
- ⏳ Stage 2 多用户的 session store（Redis）方案

---

## 2. 关联 IA 决策

- D-Layer：Auth 在 Gate 之前
- D-Layer：未登录访问 Main App 路由 → redirect Auth
- 沿用 [Phase/Home/08-NonFunctional](../Home/08-NonFunctional.md) 的限流 / CSRF / cookie 策略

---

## 3. 预期文档结构

```
Phase/Auth/
├── README.md
├── 00-Decisions.md          登录方式 / 第三方 / 安全策略决策
├── 01-Data-Model.md         UserV2 完整化 / SessionV2 / DeviceV2 / LoginAttemptV2
├── 02-Backend-WU.md         login / register / reset / refresh / device 端点
├── 03-Frontend-WU.md        login / register / reset 页 + 第三方按钮
├── 04-Security.md           登录限流 / 锁定 / 异地提醒 / 2FA
└── 05-Testing.md
```

---

## 4. 待解的设计问题

- 国内合规：手机号验证码必须？工信部备案？
- 第三方登录优先级
- 注销账号后数据保留策略（与 Profile Phase 协同）

---

## 5. 关联文档

- [../Onboarding/README.md](../Onboarding/README.md)（登录后跳转）
- [../Profile/README.md](../Profile/README.md)（绑定流共用）
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md)
- [../../../03-tech/Auth.md](../../../03-tech/Auth.md)

---

## 6. 视觉原型参考

落地实施前的 surface-level 视觉事实输入（V5 token + shell SSOT）：

| view | 路由 | 原型文件 |
|---|---|---|
| Login | `/login` | [`.tmp_review/out/Layer2-Auth/Login v1.html`](../../../../.tmp_review/out/Layer2-Auth/Login%20v1.html) |
| RegisterEmail | `/register/email` | [`.tmp_review/out/Layer2-Auth/Register Email v1.html`](../../../../.tmp_review/out/Layer2-Auth/Register%20Email%20v1.html) |
| RegisterPhone | `/register/phone` | [`.tmp_review/out/Layer2-Auth/Register Phone v1.html`](../../../../.tmp_review/out/Layer2-Auth/Register%20Phone%20v1.html) |
| ForgotPassword | `/forgot` | [`.tmp_review/out/Layer2-Auth/Forgot Password v1.html`](../../../../.tmp_review/out/Layer2-Auth/Forgot%20Password%20v1.html) |
| ResetPassword | `/reset` | [`.tmp_review/out/Layer2-Auth/Reset Password v1.html`](../../../../.tmp_review/out/Layer2-Auth/Reset%20Password%20v1.html) |

共享样式：[`.tmp_review/out/Layer2-Auth/_auth-shell.css`](../../../../.tmp_review/out/Layer2-Auth/_auth-shell.css)。原型仅作视觉参考，不是 React 实施 spec；记账见 SIK-85。
