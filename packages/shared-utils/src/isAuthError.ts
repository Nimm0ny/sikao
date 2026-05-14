import { isAxiosError } from 'axios';

// P4 audit P0-3 helper: 区分 query error 是 401/403 (auth fail) 还是其他.
// view 用这个判断决定 render AuthFallbackEmptyState (登录引导) 还是普通
// ErrorState (重试). request.ts response interceptor 401 时会清 session,
// 但这里仍要兜底 — RedirectGuard re-evaluate 跟 view re-render 之间有几帧
// 时序窗口, query 报 isError 但 RedirectGuard 还没跳 /login.
//
// 不要 narrow 到 axios error: 后端可能直接 throw 非 axios error (比如
// fetch wrapper / streaming layer). 用 status === 401 || 403 判定即可.

export function isAuthError(err: unknown): boolean {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    return status === 401 || status === 403;
  }
  // 兜底: streamingFetch.ts 等非 axios 路径可能 throw 自定义 error 带 status
  if (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
  ) {
    const status = (err as { status: number }).status;
    return status === 401 || status === 403;
  }
  return false;
}
