// @sikao/api-client — 后端 API 请求封装 barrel
// axios 实例 + React Query hooks + 类型生成入口
// 迁移自 new_web/frontend/src/api/*.ts
//
// 注意: 各 queries/*.ts 暴露大量 named export，直接 `export *` 易触发名冲突。
// 建议使用者按子路径显式 import:
//   from '@sikao/api-client/queries/wrongBookQueries'
//   from '@sikao/api-client/queries/studyPlanQueries'
//   from '@sikao/api-client/types/api.generated'
//   from '@sikao/api-client/essay-client'

export type { EssayClient } from './essay-client';
export { essayClient, realEssayClient } from './essay-client';
