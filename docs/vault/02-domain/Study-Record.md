---
type: domain
status: draft
owner: lhr
last-reviewed: 2026-05-13
---

# Study Record

## 范畴

学习记录与日计划：

- 做题记录（PracticeSession 衍生）
- 正确率
- 学习时长
- 练习历史
- 学习计划（StudyPlan / StudyPlanTask + Quotas）
- 预测分（PredictedScore）

## 后端 module

- `services/api/src/sikao_api/modules/study-record/`
- `services/api/src/sikao_api/modules/analytics/`（统计派生）

## 前端 domain

- `packages/domain/src/study-record/`
- 周视图：`apps/web/src/views/Plan.tsx`

## 复杂统计

`分析正确率随时间变化`、`知识点掌握度雷达`、`错题分布热力图` 在 brief P2，可后置。

## 状态

`not_started`
