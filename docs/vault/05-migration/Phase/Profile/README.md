# Phase · Profile（我的 tab）

> **Status**: IN PROGRESS（后端设计阶段）
> **IA 位置**：Main App Layer · Tab 5
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-21

---

## 0. 范围预览

我的 tab 是用户的设置与个人空间总入口。

### MVP 范围（后端先行 · 设计 + 占位）

- `/profile`（overview，基础信息 / 当前 plan 概览 / 跳转）
- `/profile/goals`（多目标管理 exam_targets[] 增删改）
- `/profile/info`（个人信息编辑）
- `/profile/security`（改密 + 注销入口，软删 7 天）
- `/profile/settings`（AI 调整开关 + 隐私一键关闭 LLM）
- `/profile/preferences`（dashboard_preferences 读写占位）
- 绑定手机 stub（schema 定义 + 501 占位）

### 推迟（不在 MVP）

- 绑定流实现（阿里云 SMS 对接 — 方案已定，等 Auth Phase 基础设施）
- 通知系统（推送 / 邮件 / 短信）
- 数据导出（GDPR-like 全量导出）
- 跨设备同步逻辑（仅 schema 占位）
- 邮箱绑定 / 第三方登录绑定

> **已部分实现**：[Phase/Home](../Home/README.md) 已建好 `/profile/learning`（详细学情）和 `/profile/records`（学习记录）两个钻取页，本 Phase 不重建。

---

## 1. 启动前置

- ✅ [Phase/Home](../Home/README.md) 完工：依赖 ProfileGoalV2 / ProfileInfoV2 扩展、ai_adjust_enabled 字段、dashboard_preferences
- ✅ 绑定流方案已决：阿里云短信认证（实现推迟）
- ✅ 注销策略已决：软删 7 天，不可恢复
- ⏳ Auth Phase 决定第三方登录方式（影响绑定 UI — 本 Phase 不阻塞）

---

## 2. 关键决策摘要

详见 [00-Decisions.md](./00-Decisions.md)。

| # | 决策 | 结论 |
|---|---|---|
| D-P1 | 绑定流方案 | 阿里云 SMS 验证码 |
| D-P2 | 注销语义 | 软删 7 天 → 硬删 |
| D-P3 | 推荐策略阈值 | 不暴露给用户 |
| D-P4 | 跨设备同步 | 需要做（web + mobile + tablet）；MVP 仅占位 |
| D-P7 | 绑定流节奏 | MVP 不实现，仅 stub |
| D-P8 | 注销恢复 | 无恢复机制，无撤销操作 |
| D-P10 | 路由结构 | M-Multi（概览 + 子路由） |

---

## 3. 关联 IA 决策

- Infra-Profile-Bind：BindEmail / BindPhone / CompleteProfile **从 Home 推到本 Phase**（MVP 仅 stub）
- ADJ-4：ai_adjust_enabled UI 在 `/profile/settings` 实现
- 隐私：用户可一键关闭 LLM 调用（影响 Home 的 AI 制定 / 调整 / 推荐）

---

## 4. 文档结构

```
Phase/Profile/
├── README.md              ← 本文（索引）
├── 00-Decisions.md        ✅ 全部决策 SSOT
├── 01-Data-Model.md       注销字段 / Settings schema / BindPhone schema
├── 02-Backend-WU.md       新增 endpoint 清单 + PR 拆分
├── 03-Frontend-WU.md      Profile tab 视图 + settings 子页（占位）
├── 04-Notification.md     ⏸️ 推迟（占位文件）
├── 05-Privacy-Export.md   ⏸️ 推迟（仅保留注销部分）
└── 06-Testing.md          测试策略
```

---

## 5. 已有代码基线

| 文件 | 已有内容 |
|---|---|
| `db/models_v2.py` | `ProfileInfoV2`（含 `ai_adjust_enabled`, `dashboard_preferences`, `recommender_preferences`）、`ProfileGoalV2`（含 `exam_targets`） |
| `db/schemas_v2.py` | Overview / Security / Goals / Info 的 Request/Response schema |
| `modules/profile_v2/application/service.py` | `ProfileServiceV2`：overview / security / goals / info CRUD |
| `modules/profile_v2/interface/routes.py` | 6 个 endpoint：GET/PUT overview / security / goals / info |

### MVP 需新增 endpoint

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/v2/profile/account` | `DELETE` | 注销（soft-delete user，写 `deleted_at`） |
| `/api/v2/profile/settings` | `GET` | 读取 AI 开关 + 隐私设置 |
| `/api/v2/profile/settings` | `PUT` | 更新 AI 开关 |
| `/api/v2/profile/preferences` | `GET` | 读取 dashboard_preferences |
| `/api/v2/profile/preferences` | `PUT` | 更新 dashboard_preferences（占位） |
| `/api/v2/profile/bind-phone` | `POST` | 绑定手机 stub（返回 501） |

---

## 6. 下一步

1. 编写 `01-Data-Model.md`：定义注销相关字段（`users_v2.deleted_at`）、Settings response schema、BindPhone request schema
2. 编写 `02-Backend-WU.md`：6 个新 endpoint 的 PR 拆分计划
3. 实现后端 endpoint（后端先行，前端后做）

---

## 7. 关联文档

- [00-Decisions.md](./00-Decisions.md)（全部决策 SSOT）
- [../Home/README.md](../Home/README.md)（详细学情 / 学习记录已落地）
- [../Home/02-Data-Model.md](../Home/02-Data-Model.md) §2.5（ProfileGoalV2 / ProfileInfoV2 字段）
- [../Auth/README.md](../Auth/README.md)（绑定流共用基础设施）
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md) §2.5（Tab 5 IA 选项）
