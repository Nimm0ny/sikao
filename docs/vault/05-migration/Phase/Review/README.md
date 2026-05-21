# Phase · Review（复盘 tab）

> **Status**: TBD（占位）
> **IA 位置**：Main App Layer · Tab 3
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-21

---

## 0. 范围预览

复盘 tab 是错题回归与知识点巩固的主入口。落地内容初步覆盖：

- 错题本（按时间 / 科目 / 错误类型筛选）
- 间隔重复（spaced repetition，SM-2 或 Leitner box）
- 知识点笔记关联（与 [Phase/Notes](../Notes/README.md) 联动）
- AI 错因分析（输入：错题集；输出：诊断段落，复用 Home 的 LLM 模块）
- 复盘 session 进度统计

---

## 1. 启动前置

- ✅ [Phase/Home](../Home/README.md) 完工：依赖 review.items 数据层、WeaknessSnapshotV2、recommender
- ⏳ ReviewItemV2 模型完整（已存在 stub）
- ⏳ 间隔重复算法决策（SM-2 vs FSRS vs Leitner，待选）

---

## 2. 关联 IA 决策

- 复盘流走 review session（与 practice session 模型相同 + linked_review_id）
- AI 错因分析复用 [Phase/Home/05-LLM-Module](../Home/05-LLM-Module.md) 的 provider / sanitizer / parser

---

## 3. 预期文档结构

```
Phase/Review/
├── README.md
├── 00-Decisions.md          算法选型 / 复盘节奏决策
├── 01-Data-Model.md         ReviewItemV2 完整化 / SRS state
├── 02-Backend-WU.md         review CRUD / SRS state machine / 错因分析端点
├── 03-Frontend-WU.md        Review tab 视图 + 错题卡片 + 复盘 session UI
├── 04-SRS-Engine.md         间隔重复算法实现
├── 05-AI-Cause-Analysis.md  AI 错因分析（LLM 复用）
└── 06-Testing.md
```

---

## 4. 待解的设计问题

- SRS 算法选型（SM-2 / FSRS / Leitner box，影响数据模型）
- 错因分析的批量化（单题分析 vs 一组题分析）
- 复盘"加入计划"vs"立刻做"的双入口（与 Home 的推荐 accept 流对齐）

---

## 5. 关联文档

- [../Home/README.md](../Home/README.md)
- [../Notes/README.md](../Notes/README.md)
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md)
