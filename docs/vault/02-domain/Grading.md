---
type: domain
status: draft
owner: lhr
last-reviewed: 2026-05-13
---

# Grading

## 范畴

评分领域：行测客观评分 + 申论 AI 批改。

## 行测评分

- 纯算法：`packages/answer-engine/src/scoring/xingce.ts`
- 后端校验：`services/api/src/sikao_api/modules/grading/`

## 申论批改

- 后端服务：`services/api/src/sikao_api/modules/llm/`（AI 调用）+ `modules/grading/`（结果落库）
- Model：`EssayGradingRecord` / `EssayDraftRecord`
- 维度展示：`apps/web/src/components/essay/EssayDimensionsRadar.tsx`

## 关联

- [[Answer-Session]] / [[Shenlun]] / [[Xingce]]
- LLM 子模块在 [[Architecture]] 中说明

## 状态

`not_started`
