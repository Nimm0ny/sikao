# @sikao/api-client

## Responsibility

后端 HTTP API 的统一请求层：axios 实例、React Query 查询/Mutation hooks、OpenAPI 类型同步。

## Non-goals

- 业务规则（→ `@sikao/domain`）
- UI 状态（→ `@sikao/domain` 或 store）

## Legacy Source

- `new_web/frontend/src/api/wrongBookQueries.ts`
- `new_web/frontend/src/api/studyPlanQueries.ts`
- `new_web/frontend/src/api/essaySpecialtyQueries.ts`
- `new_web/frontend/src/api/xingceSpecialtyQueries.ts`
- `new_web/frontend/src/api/examEventsQueries.ts`
- `new_web/frontend/src/api/notebookQueries.ts`
- `new_web/frontend/src/types/api.generated.ts`（OpenAPI 自动产物）
- `new_web/frontend/scripts/generate-types.mjs`

## New Location

- `packages/api-client/src/queries/*.ts`
- `packages/api-client/src/types/api.generated.ts`
- `packages/api-client/scripts/generate-types.mjs`

## Status

`not_started` — 包结构就位，待批量迁入 query 集合。

## Migrated

- 包结构

## Missing

- 6 个 query 集合（wrong-book / study-plan / essay-specialty / xingce-specialty / exam-events / notebook）
- axios 实例（含 CSRF、401 silent-refresh、queryRetry 策略）
- OpenAPI 类型生成脚本

## Dependencies

- `@tanstack/react-query`
- `axios`

## Notes

- new_web 后端 spec 位置：`apps/exam-api/spec/openapi.json` → 新位置 `services/api/spec/openapi.json`。
- queryRetry 策略（4xx fail-fast / 5xx 重试 2 次）保留。
- silent-refresh 行为依赖后端 httpOnly cookie + CSRF token，迁移时与 services/api/modules/auth 接口对齐。
