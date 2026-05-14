# @sikao/editor

## Responsibility

申论编辑器与富文本能力：田字格输入面板、材料划线轨道、草稿纸、答题区（typed/handwritten）、引用追踪。

## Non-goals

- 字数、网格布局、划线合并等纯算法（→ `@sikao/answer-engine`）
- 申论 session 状态（→ `@sikao/domain/shenlun`）

## Legacy Source

- `new_web/frontend/src/features/essay-exam/panels/{MaterialsPanel, AnswerArea, HighlightRail, ScratchPanel}.tsx`
- `new_web/frontend/src/features/essay-exam/pieces/{GridPaper, MaterialOverview, MaterialTabs, WordRuler, QuestionRing, MaterialReader, Pager, QuestionPeek}.tsx`
- `new_web/frontend/src/features/essay-exam/ExamShell.tsx`
- `new_web/frontend/src/features/essay-exam/TopBar.tsx`

## New Location

- `packages/editor/src/{grid-paper,highlight-rail,scratch-panel,answer-area,citation}/`

## Status

`not_started` — 包结构就位，组件迁移待执行。

## Migrated

- 包结构

## Missing

- 全部 panels / pieces 组件
- ExamShell 顶层壳（待决定：归 editor 还是归 apps/web）

## Dependencies

- `react@^19`
- `@sikao/answer-engine`（字数/网格/划线算法）
- `@sikao/ui`（基础 UI）

## Notes

- brief §9.6 明确要求"申论编辑器必须尽量独立，不要散落在页面中"。
- 双模考场（PR13 申论 typed/handwritten）的 dispatcher 留在 apps/web/src/views/ShenlunSession/。
