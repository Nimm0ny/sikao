# @sikao/web

## Responsibility

Web 端入口：路由、布局、页面 view、apps 私有的业务组件 fragment。

## Non-goals

- UI 基础组件（→ `@sikao/ui`）
- 业务计算（→ `@sikao/domain` / `@sikao/answer-engine`）
- API 请求（→ `@sikao/api-client`）

## Legacy Source

- `new_web/frontend/`（前端整仓）

## New Location

- `apps/web/src/{router,layouts,views,components,styles,public}/`

## Status

`partial` — 工程化（package.json / vite / tsconfig）就位，源码批量迁入待执行。

## Migrated

- package.json（含 @sikao/* workspace 依赖）
- vite.config.ts（端口 18080、proxy、alias）
- tsconfig.{json,app,node}.json（path 映射到 packages/）
- 目录骨架 src/、public/、scripts/

## Missing

- src/main.tsx
- src/router/index.tsx + RedirectPreserveQuery.tsx
- src/layouts/AppShell.tsx
- src/views/*（38 个 view 文件）
- src/components/*（apps 私有的业务组件 fragment，UI 基础已分流到 @sikao/ui）
- src/styles/*（tailwind 主入口）
- public/*（favicon / robots / index.html assets）
- index.html
- tailwind / postcss / eslint 配置
- lint:* 脚本（迁到 scripts/）

## Dependencies

- 所有 8 个 `@sikao/*` workspace 包
- React 19, react-router-dom 7, TanStack Query 5

## Notes

- 端口 18080 是硬约束（new_web AGENTS.md §11）。
- 路由总览见 `docs/vault/05-migration/Legacy-Feature-Inventory.md`。
