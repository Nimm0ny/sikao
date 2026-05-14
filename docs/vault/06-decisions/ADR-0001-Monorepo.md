---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# ADR-0001 — Monorepo 工程化

## Status

Accepted（2026-05-13）

## Context

new_web 是单仓但前端只有一个 `frontend/` package（无 workspace）。sikao 按 brief §2 要求拆 `apps/` + `packages/` + `services/` 三层，需要 monorepo 工具支持。

## Decision

采用 **npm workspaces**。

- 根 `package.json` 声明 `"workspaces": ["apps/*", "packages/*"]`
- 前端各包 `@sikao/<name>` 命名
- 后端 `services/api` 走自己的 `pyproject.toml`，**不**进 workspaces
- 各包 source-only（`main: ./src/index.ts`），不预 build；apps/web 通过 vite alias + tsconfig paths 解析

## Alternatives considered

- **pnpm workspaces**：性能更好，但 new_web 现有 npm 生态需要切换工具链，增加学习成本。
- **Turborepo / Nx**：任务编排和缓存能力强，但当前需求只是包解析，引入额外配置成本不划算。
- **纯文件夹无 workspaces**：tsconfig paths 可以解析，但 npm 不会把各 `@sikao/*` 当 package，运行时 import 路径需要绕道。

## Consequences

- 优点：与 new_web 现有 npm 生态零冲突；新加包只需在 `packages/` 下 mkdir + 写 `package.json`，根 `npm install` 自动 link
- 缺点：相比 pnpm 占用磁盘大；相比 Turborepo 无任务缓存
- 后续可演进到 Turborepo（在 workspaces 之上加任务编排）而无需重构包结构

## 关联

- [[Architecture]] / [[Frontend]] / [[Migration-Plan]]
