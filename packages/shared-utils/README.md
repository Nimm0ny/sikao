# @sikao/shared-utils

## Responsibility

跨端、跨包共享的纯工具与 UI 工具 hooks：classname 合并、日志、toast、动效、设备检测、网络在线状态、交互手势 hooks。

## Non-goals

- 业务逻辑（→ `@sikao/domain`）
- 业务算法（→ `@sikao/answer-engine`）

## Legacy Source

UI 工具 hooks（`new_web/frontend/src/hooks/`）：

- `useDevice.ts` / `useOrientation.ts` / `useOnline.ts`
- `useLongPress.ts` / `useSwipeAction.ts` / `usePullToRefresh.ts`
- `useInputMode.ts` / `useTweaks.ts`
- `useScrollSpyTab.ts`

通用 lib（`new_web/frontend/src/lib/`）：

- `cn.ts` / `logger.ts` / `toast.ts` / `toast.tsx` / `ToastHost.tsx`
- `motion.ts` / `useReducedMotion.ts`
- `timing.ts` / `silent-refresh.ts`
- `queryRetry.ts` / `isAuthError.ts`

## New Location

- `packages/shared-utils/src/{hooks,classname,logger,toast,motion,timing,auth-helpers}/`

## Status

`not_started` — 包结构就位，工具迁移待执行。

## Migrated

- 包结构

## Missing

- 所有 UI 工具 hooks 与 lib 文件

## Dependencies

- `react@^19`（peer）

## Notes

- `queryRetry.ts` 和 `isAuthError.ts` 与 `@sikao/api-client` 协作（api-client 内 import 本包）。
- `ToastHost.tsx` 是 React 组件，但作为基础设施工具放在本包；不归 `@sikao/ui`（ui 不依赖 React 状态架构）。
