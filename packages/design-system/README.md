# @sikao/design-system

## Responsibility

设计系统 SSOT：颜色（paper/ink/line/accent/semantic）、字号 8 档、间距 9 档、圆角 7 档、阴影 2 档、motion、letter-spacing 7 档。

## Non-goals

- 组件实现（→ `@sikao/ui`）
- 端侧布局（→ `apps/web/src/styles`、`apps/mobile/...`）

## Legacy Source

- `new_web/frontend/src/styles/tokens.css`
- `new_web/element/colors_and_type.css`（marketing landing）
- `new_web/design/tokens.css`（设计稿原型）

## New Location

- `packages/design-system/src/tokens.css`（待迁移）
- `packages/design-system/src/tailwind-preset.js`（待建立）

## Status

`partial` — 包结构就位，token CSS 待迁移。

## Migrated

- 包结构

## Missing

- tokens.css 主文件
- Tailwind preset（如新项目沿用 tailwind）
- TypeScript token 常量导出

## Dependencies

无。

## Notes

- new_web 老规则要求三处 SSOT 1:1 对齐（`frontend/src/styles/tokens.css` + `element/colors_and_type.css` + `design/tokens.css`）。sikao 收敛到本包后，marketing landing 与设计稿可改为 import 本包 CSS 或同步生成，避免三处漂移。
