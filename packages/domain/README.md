# @sikao/domain

## Responsibility

前端业务领域层：领域模型、业务 hooks、状态机、派生逻辑。页面（apps/web）只通过 import 本包的 hooks 拿数据和操作，不直接持有业务计算。

## Non-goals

- HTTP 请求（→ `@sikao/api-client`）
- UI 渲染（→ `@sikao/ui` / `apps/web`）
- 答题核心算法（→ `@sikao/answer-engine`）
- 编辑器（→ `@sikao/editor`）

## Legacy Source

业务 hooks（new_web/frontend/src/hooks/）：

- `useAskSession.ts`
- `useEssayDraft.ts`
- `useWrongQuestionItem.ts`
- `useEssaySessionElapsed.ts`
- `useCommunityNotes.ts`
- `useWrongBookHeatmap.ts`
- `useHomeData.ts`
- `useStudyPlanRouting.ts`
- `useFbSettings.ts`

业务 lib（new_web/frontend/src/lib/）：

- `exam-countdown.ts`
- `exam-tracking.ts`
- `category-canonicalize.ts`
- `viewMode.ts`
- `practiceFontSize.ts`
- `isGraphicReasoning.ts`

业务 store（new_web/frontend/src/store/）：

- `useAuthStore.ts`
- `usePracticeStore.ts`
- `useHighlightStore.ts`

## New Location

- `packages/domain/src/<sub-domain>/`

## Status

`not_started` — 包结构就位，子领域目录与 hook 迁移待批次进行。

## Migrated

- 包结构

## Missing

所有业务 hooks / store / 派生逻辑。

## Dependencies

- `zustand`（store）
- `react`（peer，hooks 用）
- `@sikao/api-client`（peer 形式，hook 内 import）

## Notes

- 迁移时**重新分类**：UI 工具 hooks（useDevice / useOrientation / useOnline / useLongPress / useSwipeAction / usePullToRefresh / useInputMode / useReducedMotion / useScrollSpyTab / useTweaks）不属于本包，归 `@sikao/shared-utils`。
- 行测/申论的 scoring、字数计算、田字格布局、划线范围合并属于 `@sikao/answer-engine`，不在本包。
