import { api } from '@sikao/api-client/request';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';

// Post-Phase D N1 — proactive silent refresh.
//
// Why proactive (not reactive 401-retry):
//   - cookie expiry 一到, 任何 state-mutating call 立即 403/401, 用户体验
//     是"突然不能交卷". 反应式 refresh 在 401 触发时再调, 但 csrf cookie
//     也同期过期 → /auth/refresh 自己也 403.
//   - 主动模式: 提前 N 分钟在 cookie 仍有效时调 /refresh, 后端 re-issue
//     新 cookie. SPA 不打扰.
//
// 单 tab 实现. 多 tab 同步 (BroadcastChannel) 推 v0.4.

const REFRESH_LEAD_MS = 2 * 60 * 1000; // refresh 2 min before expiry
const MIN_DELAY_MS = 1000; // never schedule sooner than 1s in future

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

interface RefreshResponse {
  readonly expiresIn: number;
  readonly user: { id: number; username: string; displayName: string };
}

function clearTimer(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

async function performRefresh(): Promise<void> {
  try {
    // api.post returns the body directly (response interceptor unwraps .data).
    const resp = await api.post<RefreshResponse>('/auth/refresh');
    const user = useAuthStore.getState().user;
    if (user !== null) {
      useAuthStore.getState().setSession(user, resp.expiresIn);
    }
  } catch (err) {
    // failure → user must re-login. clearSession will reschedule (no-op
    // because expiresAt becomes null).
    logger.warn('auth.silent_refresh.failed', { err: String(err) });
    useAuthStore.getState().clearSession();
  }
}

function scheduleRefresh(sessionExpiresAt: number | null): void {
  clearTimer();
  if (sessionExpiresAt === null) return;
  const delay = Math.max(sessionExpiresAt - Date.now() - REFRESH_LEAD_MS, MIN_DELAY_MS);
  refreshTimer = setTimeout(() => {
    void performRefresh();
  }, delay);
}

/** Wire up subscription. Call ONCE from main.tsx after store hydration. */
export function startSilentRefreshScheduler(): void {
  scheduleRefresh(useAuthStore.getState().sessionExpiresAt);
  useAuthStore.subscribe((s) => scheduleRefresh(s.sessionExpiresAt));
}
