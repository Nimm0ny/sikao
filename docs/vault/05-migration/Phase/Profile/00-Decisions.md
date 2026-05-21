# Phase-Profile · 00 · Decisions

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`

本文是 Phase-Profile 范围内**全部决策的 SSOT**。任何后续 PR 与此文档冲突时以本文档为准。

---

## 0. 决策序列编号约定

| 前缀 | 域 |
|---|---|
| `D-P` | Profile Phase 顶层决策 |
| `Bind-` | 绑定流（手机 / 邮箱 / 第三方） |
| `Del-` | 注销 / 删除策略 |
| `Sync-` | 跨设备同步 |
| `Priv-` | 隐私 / 推荐策略 |
| `Notif-` | 通知系统 |

---

## 1. 顶层决策（D-P 系列）

| # | 问题 | 决策 | 拍板日期 |
|---|---|---|---|
| D-P1 | 绑定流技术方案 | **阿里云短信认证**（SMS 验证码）；邮箱 magic link 不做 | 2026-05-21 |
| D-P2 | 注销语义 | **软删 + 7 天宽限期**；过期后硬删（不可逆） | 2026-05-21 |
| D-P3 | 推荐策略阈值是否暴露 | **不暴露**；后台调控，UI 无入口 | 2026-05-21 |
| D-P4 | 跨设备 dashboard_preferences 同步 | **需要做**（多端：web + mobile + tablet）；具体方案后续设计 | 2026-05-21 |
| D-P5 | 数据导出（GDPR-like） | **Phase-Profile MVP 不做**；后续单独排期 | 2026-05-21 |
| D-P6 | 通知系统 | **Phase-Profile MVP 不做**；后续单独排期 | 2026-05-21 |
| D-P7 | 绑定流实现节奏 | **Phase-Profile MVP 不做绑定流实现**；仅后端占位（schema + stub endpoint）；具体 SMS 对接留给后续迭代 | 2026-05-21 |
| D-P8 | 注销恢复机制 | **不提供恢复 / 撤销注销的显式操作**；7 天宽限期内不可自行恢复，过期自动硬删 | 2026-05-21 |
| D-P9 | 跨设备同步实现节奏 | **Phase-Profile MVP 不实现同步逻辑**；仅设计好后端 schema，占位 endpoint；具体同步策略后续迭代 | 2026-05-21 |
| D-P10 | Profile 路由结构 | **M-Multi**（概览 + 子路由），沿用 IA-V2 D11 决策 | 2026-05-21 |

---

## 2. 绑定流决策（Bind 系列）

| # | 决策 | 备注 |
|---|---|---|
| Bind-1 | 短信验证码走阿里云 SMS | 国内合规；用户绑定手机场景 |
| Bind-2 | MVP 不实现绑定流 | 仅设计 schema + stub；不对接阿里云 |
| Bind-3 | 邮箱绑定不做 | 不走 magic link，不做邮箱绑定 |
| Bind-4 | 第三方登录绑定 | 跟随 Auth Phase，本 Phase 不涉及 |

---

## 3. 注销 / 删除决策（Del 系列）

| # | 决策 | 备注 |
|---|---|---|
| Del-1 | 软删 7 天宽限期 | `users_v2.deleted_at` 写入当前时间；7 天后 cron 硬删 |
| Del-2 | 不提供撤销注销操作 | 宽限期内用户重新登录**不自动恢复**；无"撤销注销"按钮 |
| Del-3 | 硬删范围 | 用户数据全量清除（CASCADE）；审计日志保留（脱敏后归档） |
| Del-4 | 注销入口 | `/profile/security` 页底部 danger zone |

---

## 4. 隐私 / 推荐决策（Priv 系列）

| # | 决策 | 备注 |
|---|---|---|
| Priv-1 | 推荐策略阈值 | 不暴露给用户；`recommender_preferences` 字段仅存后台调控参数 |
| Priv-2 | AI 调整开关 | 保留 `ai_adjust_enabled` 开关；用户可一键关闭 LLM 调用（已在 ProfileInfoV2 落地） |
| Priv-3 | 隐私设置 UI | `/profile/settings` 仅含 AI 开关 + LLM 关闭说明；不做推荐策略面板 |

---

## 5. 跨设备同步决策（Sync 系列）

| # | 决策 | 备注 |
|---|---|---|
| Sync-1 | 需要多端同步 | 后续支持 web + mobile + tablet 三端 |
| Sync-2 | MVP 仅设计 schema | `dashboard_preferences` 已在 ProfileInfoV2 落地（JSONB）；本阶段确保字段结构可扩展 |
| Sync-3 | 同步策略待定 | 候选：A）打开时拉最新 / B）实时推送 / C）写入广播 + 打开兜底；后续迭代决定 |

---

## 6. 通知决策（Notif 系列）

| # | 决策 | 备注 |
|---|---|---|
| Notif-1 | MVP 不做通知系统 | 不设计 NotificationPreference；不做推送 / 邮件 / 短信 |
| Notif-2 | 文档占位 | `04-Notification.md` 保留为占位文件，后续排期时填充 |

---

## 7. MVP 范围总结

### 纳入 MVP（后端先行 · 设计 + 占位）

| 模块 | 内容 | 实现深度 |
|---|---|---|
| Profile Overview | `/profile` 概览页（已有 endpoint） | 完善 response 结构 |
| Goals | `/profile/goals` 多目标管理 | 完善 `exam_targets[]` CRUD |
| Info | `/profile/info` 个人信息 | 已有，保持 |
| Security | `/profile/security` 改密 + 注销入口 | 新增注销 endpoint（soft-delete） |
| Settings | `/profile/settings` AI 开关 | 新增 endpoint（读写 `ai_adjust_enabled`） |
| 注销 | `DELETE /api/v2/profile/account` | 写 `deleted_at`；cron job schema 设计 |
| 绑定占位 | `POST /api/v2/profile/bind-phone` | stub 501；schema 定义好 |
| 同步占位 | `PUT /api/v2/profile/preferences` | 读写 `dashboard_preferences`；无同步逻辑 |

### 推迟

| 模块 | 推迟原因 |
|---|---|
| 绑定流实现（阿里云 SMS 对接） | 等 Auth Phase 基础设施 |
| 通知系统 | 整体推迟 |
| 数据导出 | 整体推迟 |
| 跨设备同步逻辑 | 仅占位，后续迭代 |
| 邮箱绑定 / 第三方绑定 | 不做 |

---

## 8. 已有代码基线

以下后端代码已存在，Phase-Profile 在此基础上扩展：

| 文件 | 已有内容 |
|---|---|
| `db/models_v2.py` | `ProfileInfoV2`（含 `ai_adjust_enabled`, `dashboard_preferences`, `recommender_preferences`）、`ProfileGoalV2`（含 `exam_targets`） |
| `db/schemas_v2.py` | Overview / Security / Goals / Info 的 Request/Response schema |
| `modules/profile_v2/application/service.py` | `ProfileServiceV2`：overview / security / goals / info 的 CRUD |
| `modules/profile_v2/interface/routes.py` | 6 个 endpoint：GET/PUT overview / security / goals / info |

### 需新增

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/v2/profile/account` | `DELETE` | 注销（soft-delete user） |
| `/api/v2/profile/settings` | `GET` | 读取 AI 开关 + 隐私设置 |
| `/api/v2/profile/settings` | `PUT` | 更新 AI 开关 |
| `/api/v2/profile/preferences` | `GET` | 读取 dashboard_preferences |
| `/api/v2/profile/preferences` | `PUT` | 更新 dashboard_preferences（占位） |
| `/api/v2/profile/bind-phone` | `POST` | 绑定手机 stub（501） |

---

## 9. 关联文档

- [./README.md](./README.md)（Phase 索引）
- [../Home/00-Decisions.md](../Home/00-Decisions.md)（D1 / D11 源决策）
- [../Home/02-Data-Model.md](../Home/02-Data-Model.md) §2.5（ProfileGoalV2 / ProfileInfoV2 字段定义）
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md) §2.5（Tab 5 IA 选项）
