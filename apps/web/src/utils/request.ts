// R2.4 (2026-05-13): axios 实例与 CSRF / 401 拦截器已抽到 @sikao/api-client
// (单一 SSOT). 本文件 re-export 保持 backward-compat 给 apps/web 内部 views
// (避免一次性改 ~30 个 view 的 import). 新代码请直接从 @sikao/api-client 引入.
export {
  API_BASE_URL,
  request,
  api,
  readCsrfTokenFromCookie,
} from '@sikao/api-client/request';
