# Phase · Profile（我的 tab）

> **Status**: TBD（占位）
> **IA 位置**：Main App Layer · Tab 5
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-21

---

## 0. 范围预览

我的 tab 是用户的设置与个人空间总入口。本 Phase 范围：

- `/profile`（overview，基础信息 / 当前 plan 概览 / 跳转）
- `/profile/settings`（账号 / 通知 / 隐私 / AI 调整开关 / 推荐策略偏好）
- `/profile/account`（绑定邮箱 / 手机 / 第三方 / 注销）
- 多目标管理（exam_targets[] 增删改）
- 数据导出（GDPR-like，全量数据导出）

> **已部分实现**：[Phase/Home](../Home/README.md) 已建好 `/profile/learning`（详细学情）和 `/profile/records`（学习记录）两个钻取页，本 Phase 不重建。

---

## 1. 启动前置

- ✅ [Phase/Home](../Home/README.md) 完工：依赖 ProfileGoalV2 / ProfileInfoV2 扩展、ai_adjust_enabled 字段、dashboard_preferences
- ⏳ Auth Phase 决定第三方登录方式（影响绑定 UI）
- ⏳ 通知系统（推送 / 邮件 / 短信）方案

---

## 2. 关联 IA 决策（Infra-Profile-Bind 解锁）

- Infra-Profile-Bind：BindEmail / BindPhone / CompleteProfile **从 Home 推到本 Phase**
- ADJ-4：ai_adjust_enabled UI 在本 Phase 实现
- 隐私：用户可一键关闭 LLM 调用（影响 Home 的 AI 制定 / 调整 / 推荐）

---

## 3. 预期文档结构

```
Phase/Profile/
├── README.md
├── 00-Decisions.md          隐私 / 通知 / 注销策略决策
├── 01-Data-Model.md         ProfileV2 完整字段补全 / NotificationPreference / DataExportJob
├── 02-Backend-WU.md         account / settings / multi-target / export 端点
├── 03-Frontend-WU.md        Profile tab 视图 + settings 子页 + 绑定流
├── 04-Notification.md       通知系统设计（推 / 邮 / 短信）
├── 05-Privacy-Export.md     数据导出 / 注销
└── 06-Testing.md
```

---

## 4. 待解的设计问题

- 绑定流（短信验证码 vs 邮箱 magic link，国内合规）
- 注销的"软删 vs 硬删"语义（30 天宽限期？）
- 推荐策略阈值是否暴露给所有用户（已 Stage 2 决定）
- 跨设备 dashboard_preferences 同步频率

---

## 5. 关联文档

- [../Home/README.md](../Home/README.md)（详细学情 / 学习记录已落地）
- [../Auth/README.md](../Auth/README.md)（绑定流共用基础设施）
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md)
