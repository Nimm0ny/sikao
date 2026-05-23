# @sikao/editor

## Status

**FROZEN 2026-05-24 — V5-M0.5 big-bang rebuild**

This package depends on `@sikao/ui` which was removed in V5-M0.5 commit 3
(big-bang scrap of V4 component library). 13 files in `src/` (TopBar +
ExamShell + 5 pieces + 4 panels + 3 modals) currently import V4 icons /
Tooltip from `@sikao/ui/icons` and `@sikao/ui/ui`, so:

- `tsc --noEmit` will fail with TS2307 module-not-found errors
- runtime usage of editor will throw on first import
- `package.json` `typecheck` script renamed to `typecheck:frozen` so the
  monorepo `npm run typecheck --workspaces --if-present` command skips this
  package and the V5 main pipeline stays green

The independent Exam spec (R1/Q5 + R2/Q6 — see V5 design.md §D.4.6) will
re-thaw this package: it will replace `@sikao/ui/icons` with the V5 SVG
sprite (`packages/design-system/src/icons/*.svg` from V5-M4) and
`@sikao/ui/ui/Tooltip` with the V5 D.3.19 Tooltip component (V5-M3).

Until then, do NOT import from `@sikao/editor` in any new code path.

## Responsibility (post-thaw)

申论编辑器与富文本能力：田字格输入面板、材料划线轨道、草稿纸、答题区（typed/handwritten）、引用追踪。

## Non-goals

- 字数、网格布局、划线合并等纯算法（→ `@sikao/answer-engine`）
- 申论 session 状态（→ `@sikao/domain/shenlun`）

## Dependencies

- `react@^19`
- `@sikao/answer-engine`（字数/网格/划线算法）
- ~~`@sikao/ui`（基础 UI）~~ — **REMOVED 2026-05-24, V5-M0.5 big-bang**;
  rewired to V5 SVG sprite + V5 components in independent Exam spec.

## Notes

- brief §9.6 明确要求"申论编辑器必须尽量独立，不要散落在页面中"。
- 双模考场 dispatcher 原在 `apps/web/src/views/ShenlunSession/`（已 V5-M0.5 删除）。
