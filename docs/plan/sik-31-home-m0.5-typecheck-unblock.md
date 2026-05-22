---
type: plan
status: active
owner: Codex
created: 2026-05-22
updated: 2026-05-22
issue: SIK-31
---

# SIK-31 Home M0.5 Frontend Full Typecheck Unblock

## Goal

解锁 repo-root `npm run typecheck`，把 Home 前端后续 runtime 的硬前置从“已知 blocker”推进到“可用门禁”。

## Locked Boundaries

1. Frontend typecheck boundary
- 本阶段采用 monorepo 源码级 typecheck。
- 不做 package project reference DAG 重构。
- 当前 `api-client <-> domain` 仍有源码级循环依赖，不把 `SIK-31` 扩成可发布包构建整改。
- frontend packages 允许直接消费 workspace 源文件，但不能继续依赖 `rootDir: "src"` 这种单包编译假设。

2. OpenAPI SSOT
- SSOT 固定为 `services/api/spec/openapi.json -> packages/api-client/src/types/api.generated.ts`。
- `api.generated.ts` 只允许通过生成流程更新。
- 禁止手写补 `components["schemas"]` 假名字。
- current OpenAPI 已覆盖的类型必须优先对齐 generated canonical 名。

3. Legacy adjunct contract layer
- `packages/api-client/src/types/api.d.ts` 定义为 legacy frontend adjunct contract layer。
- 只承接“前端仍在消费、但 current locked OpenAPI 尚未覆盖的 DTO”与现存稳定辅助 DTO。
- 禁止把 current OpenAPI 已覆盖的 schema 再复制进 adjunct layer。

4. Package boundary
- package 不得依赖 `apps/web` 私有路径。
- 禁止 package 内出现 `@/*`、`@/lib/ui-copy` 与其它 app-only alias。
- package 自身样式导入声明必须在 package 编译边界内闭合。
- `packages/ui` 组件不再依赖 app copy；调用方可显式覆写文案，未覆写时使用包内默认登录文案。

## Execution Tranches

### T1 Shared tsconfig baseline
- 新建根级 `tsconfig.frontend-package.json`。
- 统一 frontend package 类型环境：`vitest/globals`、`@testing-library/jest-dom`、`node`、`vite/client`。
- `packages/answer-engine`、`api-client`、`config`、`design-system`、`domain`、`editor`、`shared-utils`、`ui` 全部继承该基线。
- 移除这些 package 的 `rootDir: "src"`。

### T2 Package boundary and missing module cleanup
- `packages/ui`、`packages/editor` 各自补 `*.css` 声明。
- `packages/ui/src/ui/AuthFallbackEmptyState.tsx` 去掉 `@/lib/ui-copy` 依赖。
- 清理 package 内任何 app 私有 alias。
- `packages/editor` 全量对齐 canonical imports：`@sikao/domain/shenlun/useExamSession`、`@sikao/answer-engine/*`、`@sikao/test-utils/essayExamMock`。

### T3 Adjunct type layer and stale consumer repair
- 扩充 `packages/api-client/src/types/api.d.ts`，承接 wrong-book、exam-events、notebook、community notes、essay/xingce specialty、essay draft 等 legacy DTO。
- 目标 consumer 不再直接索引不存在的 generated schema 名。

### T4 Strictness debt cleanup
- 在类型塌陷修复后清掉剩余真实 strict 错误。
- 重点范围：`apps/web/src/components/{essay,notes,wrong-book}/*`、`apps/web/src/views/{CategoryTree,EssayPapers,EssaySpecialty,NotesHome,Papers}.tsx`、`packages/api-client/src/queries/examEventsQueries.ts`。

## Validation

- Required: `npm run typecheck`, `npm run lint`, `npm run test --workspaces --if-present`, `npm run build -w @sikao/web`。
- 禁止用 `any`、`as any`、`@ts-ignore`、删 contract 消费面来伪过关。

## Non-Goals

- 不启动 `SIK-38` Home runtime。
- 不改后端 OpenAPI 契约。
- 不重做 frontend project references / publish pipeline。
