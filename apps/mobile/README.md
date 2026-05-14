# @sikao/mobile

## Status

`not_started`

## Responsibility

手机端入口（响应式 + 触控优化）。预留位，新项目暂不实施。

## Non-goals

- 复用 web 端的业务逻辑（必须 `import` `@sikao/domain` 与 `@sikao/answer-engine`，禁止复制）
- 自己实现答题评分（同上）

## Legacy Source

- `new_web/frontend/src/views/dashboard/DashboardMobile.tsx`（响应式 fragment）
- `new_web/frontend/src/hooks/useDevice.ts` 中 mobile 断点判断

## New Location

- `apps/mobile/`

## Migrated

- 占位 README

## Missing

- 整个端的工程骨架（package.json / vite / RN / Expo 待选）
- 端侧入口（screens / navigation）
- 设备特有交互（手势、屏幕方向）

## Notes

- brief §6.3 明令：mobile / tablet / web 三端**共享业务逻辑**，不允许各自复制 score/state 等逻辑。
- 端侧选型（PWA / Capacitor / React Native / Expo）需要单独立 ADR 决策。
