# @sikao/config

## Responsibility

前端共享配置：API base URL、前端端口、功能开关、环境变量类型定义、Vite/Tailwind 共享 preset 入口。

## Non-goals

- 设计 token（→ `@sikao/design-system`）
- 业务规则（→ `@sikao/domain`）

## Legacy Source

- `new_web/frontend/src/styles/` 中的与环境相关的常量
- `new_web/AGENTS.md` §11 中"前端端口 18080"硬约束的代码侧落点

## New Location

- `packages/config/src/{env,endpoints,feature-flags}.ts`

## Status

`not_started`

## Migrated

- 包结构

## Missing

- 环境变量 schema（结合 sikao Vite env）
- API endpoint 常量
- Feature flags 类型

## Dependencies

无。
