// R2.4 (2026-05-13): 前端契约类型 SSOT 已搬到 @sikao/api-client/types/api.
// 这里 re-export 保持 backward-compat 给 apps/web 内部 views (~70+ 文件 import
// 自此).  新代码请直接从 @sikao/api-client/types/api 引入.
export * from '@sikao/api-client/types/api';
