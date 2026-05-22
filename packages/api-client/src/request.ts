// axios 实例 + CSRF 注入 + 401 silent refresh
//
// R2.4 (2026-05-13): 从 apps/web/src/utils/request.ts 抽到 @sikao/api-client (单一 SSOT).
// apps/web/src/utils/request.ts 留作 backward-compat 再导出 shim.
//
// 注意: 当前 401 拦截器调用 useAuthStore.clearSession() — 这是
// @sikao/api-client → @sikao/domain 的反向依赖. 架构上不理想 (按 ADR-0001
// 该方向应是 domain → api-client). 短期容忍, R3 通过依赖注入回调模式解耦
// (api-client 暴露 onAuthExpired 钩子, domain/auth 注册自己的 clearSession).

import axios, { AxiosHeaders, type AxiosRequestConfig } from 'axios';
import { logger } from '@sikao/shared-utils';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';

type RuntimeAppConfig = {
  API_BASE_URL?: string;
};

type RuntimeWindow = Window & {
  __APP_CONFIG__?: RuntimeAppConfig;
};

// 运行时 config 优先（部署时通过 window.__APP_CONFIG__ 注入），其次 vite env，
// 最后 fallback `/api/v2`（dev 用 vite proxy 转 backend :8000）.
export const API_BASE_URL =
  (typeof window !== 'undefined' &&
    (window as RuntimeWindow).__APP_CONFIG__?.API_BASE_URL) ||
  import.meta.env.VITE_API_BASE_URL ||
  '/api/v2';

// withCredentials=true 让浏览器自动携带 auth_session_v2 / csrf_token_v2 cookie.
// 配合后端 dual-fallback dependency (Phase B.1b)，JWT 不再 stays in JS scope，
// 而是 httpOnly cookie 里。
export const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

export const api = {
  get<T>(url: string, config?: AxiosRequestConfig) {
    return request.get<T, T>(url, config);
  },
  post<TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: AxiosRequestConfig<TBody>
  ) {
    return request.post<TResponse, TResponse, TBody>(url, data, config);
  },
  put<TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: AxiosRequestConfig<TBody>
  ) {
    return request.put<TResponse, TResponse, TBody>(url, data, config);
  },
  patch<TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: AxiosRequestConfig<TBody>
  ) {
    return request.patch<TResponse, TResponse, TBody>(url, data, config);
  },
  delete<TResponse = void>(url: string, config?: AxiosRequestConfig) {
    return request.delete<TResponse, TResponse>(url, config);
  },
};

// Request Interceptor —— CSRF 注入
//
// cookie-only auth:
//   - 不再 Authorization Bearer 注入. 后端 cookie 优先 (B.1b dual fallback),
//     httpOnly cookie 自动跑 (withCredentials=true). 前端不再持有 token in JS.
//   - 加 X-CSRF-Token 注入: 读 document.cookie 中的 csrf_token_v2 (非 httpOnly).
//     后端校验 cookie csrf_token_v2 == header X-CSRF-Token (B.3 double-submit).
//     不再从 store 读 —— single source of truth = cookie.
// Exported for streamingFetch (fetch + ReadableStream needs CSRF on
// mutating SSE POST; axios interceptor below covers regular calls).
export function readCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const cookieNames = ['csrf_token_v2', 'csrf_token'];
  for (const part of document.cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (cookieNames.includes(name)) {
      return rest.join('=') || null;
    }
  }
  return null;
}

request.interceptors.request.use(
  (config) => {
    const csrf = readCsrfTokenFromCookie();
    if (csrf !== null) {
      config.headers = AxiosHeaders.from(config.headers);
      config.headers.set('X-CSRF-Token', csrf);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor —— 401 清 session
request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error: unknown) => {
    // Log once here for observability; do NOT swallow. Callers must still await
    // and handle (React Query / try-catch + toast) —— fail-fast per harness §3.1.
    logger.error('api.request.failed', { err: String(error) });
    // Phase 5.6b —— 401 清 session。RedirectGuard 会在下次渲染时把用户送回 `/`。
    // 不在这里主动 navigate（interceptor 不持有 router context）。
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: { status?: number } }).response?.status === 'number' &&
      (error as { response: { status: number } }).response.status === 401
    ) {
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);
