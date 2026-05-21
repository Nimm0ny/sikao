# Phase · Practice（练习 tab）

> **Status**: TBD（占位）
> **IA 位置**：Main App Layer · Tab 2
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-21

---

## 0. 范围预览

练习 tab 是用户做题的主要入口。落地内容初步覆盖：

- 题库浏览（按科目 / 子题型 / 难度 / 来源 / 真题年份过滤）
- 练习模式选择（顺序 / 随机 / 智能推荐 / 弱项强化 / 真题套卷 / 模考）
- 申论入口（写作 + AI 批改，需 EssaySubmissionV2/EssayReportV2 路由暴露）
- 收藏与"再做一遍"
- 练习历史快速回看（深度回看在 [Phase/Profile](../Profile/README.md) 的 `/profile/records`）

---

## 1. 启动前置

- ✅ [Phase/Home](../Home/README.md) 完工：依赖 PlanEventV2 / PracticeSessionV2.linked_plan_event_id
- ✅ Home 的 LLM 模块就位（智能推荐 / 弱项强化 复用 recommender）
- ⏳ 申论 V2 模型（EssaySubmissionV2 / EssayReportV2）已建表但路由未暴露
- ⏳ 题库去重 / 抓取流水线（不在本 Phase）

---

## 2. 关联 IA 决策

- D7 答题 / 结果脱壳（已在 Home 范围实现脱壳路由）
- D15 脱壳路由 4 条
- 沿用 Home 的：限流 / 幂等 / audit / 离线策略

---

## 3. 预期文档结构

```
Phase/Practice/
├── README.md                索引（本文）
├── 00-Decisions.md          范围决策（科目 / 模式 / 真题来源）
├── 01-Data-Model.md         题库切片 / Mock / SubjectTaxonomy
├── 02-Backend-WU.md         题库浏览 / mock / essay submit / 推荐入口
├── 03-Frontend-WU.md        Practice tab 视图 + 模式选择 + 题目卡片
├── 04-Mock-Engine.md        模考评分 / 答题机
├── 05-Essay-AI-Grading.md   申论 AI 批改（复用 LLM 模块）
└── 06-Testing.md
```

---

## 4. 待解的设计问题

- 智能推荐入口与首页 Section C 的关系（是否同一推荐流？）
- 模考阅卷与"做完即看分"的边界
- 申论批改的费用 / 配额（成本可能高于行测推荐）
- 题库版本化（同一题目多版本时优先级）

---

## 5. 关联文档

- [../Home/README.md](../Home/README.md)
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md)
- [../../Legacy-Feature-Inventory.md](../../Legacy-Feature-Inventory.md)
