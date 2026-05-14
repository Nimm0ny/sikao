# @sikao/ui

## Responsibility

通用 UI 组件库：Button / Card / Drawer / Skeleton / Rail / Lightbox / 40+ Icons / Logo / Brand mark。

## Non-goals

- 业务组件（错题卡、PaperListCard、PracticeDeck 等）→ 走 `apps/web/src/components`
- 业务逻辑（state、计算、API 调用）→ 走 `@sikao/domain`
- 设计 token（颜色、字号、间距、圆角）→ 走 `@sikao/design-system`

## Legacy Source

- `new_web/frontend/src/components/ui/`
- `new_web/frontend/src/components/icons/`
- `new_web/frontend/src/components/brand/`

## New Location

- `packages/ui/src/`（待迁移）

## Status

`partial` — 目录已建立、package.json 就位；具体组件待批量迁移。

## Migrated

- 包结构 + workspace 注册
- 入口 `src/index.ts`

## Missing

- ui/* 所有组件（Button, Card, Drawer, Rail, Skeleton, ImageLightbox, TweaksDrawer 等）
- icons/* 40+ SVG 图标 + composite icons
- brand/* Logo / Wordmark

## Dependencies

- `@sikao/design-system`（token 来源）
- `react@^19`

## Notes

- 迁移时遵守 `new_web/AGENTS.md` §4 的"组件圆角 SSOT 七档"和"italic 政策"硬约束。
- SVG-only 答题按钮铁律见 brief §4 hardcoded 列表。
