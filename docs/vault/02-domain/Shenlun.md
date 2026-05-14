---
type: domain
status: draft
owner: lhr
last-reviewed: 2026-05-13
---

# Shenlun 申论

## 范畴

申论主观题作答与批改。

## 覆盖

- 材料阅读（MaterialGroup / MaterialReader）
- 题目展示（含字数限制）
- 田字格作答（GridPaper / WordRuler）
- 草稿纸（ScratchPanel）
- 划线（HighlightRail）
- 引用追踪（citation）
- 草稿保存（debounce 2s autosave）
- 提交
- AI 批改结果展示（EssayGradingRecord）

## 实现分布

- 编辑器组件 → `packages/editor/`
- 算法（字数、网格布局、划线合并） → `packages/answer-engine/{word-limit,grid-layout,highlight}`
- 申论领域 hooks → `packages/domain/src/shenlun/`
- 页面 dispatcher → `apps/web/src/views/ShenlunSession/`
- 后端 → `services/api/src/sikao_api/modules/{essay,answer-session,grading}/`

## 双模考场（PR13）

device-aware shell：

- tablet landscape (TD1/TD1b)
- tablet portrait (TD2)
- desktop fallback

dispatcher 在 web 端，子布局抽到 `packages/editor`。

## 不完整处理

按 brief §9.6：

- 旧申论批改逻辑不完整 → 标 `partial`
- 只作答没批改 → 批改模块 `not_started`
- 申论编辑器必须独立到 `packages/editor`，不散落

## 状态

`not_started`
