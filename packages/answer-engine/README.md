# @sikao/answer-engine

## Responsibility

答题流的纯逻辑核心：会话状态机、行测/申论评分、计时器、划线合并、字数计算、田字格布局、题型识别。

## Non-goals

- React hooks（→ `@sikao/domain`）
- UI 渲染（→ `@sikao/ui`）
- API 请求（→ `@sikao/api-client`）

## Legacy Source

- `new_web/frontend/src/features/essay-exam/lib/bodyChars.ts`
- `new_web/frontend/src/features/essay-exam/lib/gridLayout.ts`
- `new_web/frontend/src/features/essay-exam/lib/highlightRanges.ts`
- `new_web/frontend/src/features/essay-exam/lib/wordLimits.ts`
- `new_web/frontend/src/lib/isGraphicReasoning.ts`
- `new_web/frontend/src/lib/timing.ts`（部分）
- 业务计算分散在 views（PracticeSession / Result）—— 迁移时抽离

## New Location

- `packages/answer-engine/src/{session,scoring,timing,highlight,word-limit,grid-layout,graphic-detect}/`

## Status

`not_started` — 包结构就位，算法迁移待执行。

## Migrated

- 包结构

## Missing

- 全部 7 个子模块的纯逻辑实现
- 答题会话状态机定义（brief §9.4 建议 7 个状态）

## Dependencies

无运行时依赖（纯逻辑）。

## Notes

- 这是 brief §9.4 / §9.5 / §9.6 强调的"业务核心模块"，不允许散落到页面里。
- 服务端 services/api/modules/grading 可 import 本包（如果选择 backend 复用同一份评分逻辑）。
