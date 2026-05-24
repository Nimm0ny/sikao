import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Phase B.4b + post-Phase D P1-1 — 登录态 (user 字段) 持久化到 localStorage。
// JWT 已迁到 httpOnly cookie (auth_token)，CSRF 走 cookie channel
// (csrf_token，非 httpOnly 让 JS 可读)；都不存这里。
// request.ts 的 interceptor 从 document.cookie 读 csrf_token 注入
// X-CSRF-Token header；RedirectGuard 用 `user == null` 判定是否登录 (user
// 是 UI 信号, cookie 是真实 auth, 登录/登出时两者同步).
//
// Fail-fast：localStorage 不可用时（无痕模式/企业锁）zustand persist 退
// 化为内存；用户体验是"刷新后退出登录"，可接受。

export interface AuthUserSummary {
  readonly id: number;
  readonly displayName: string;
  // Identity v2 (D6/D7): username 改 nullable (新 phone 注册无 username);
  // 加 phone / phoneVerified / needsIdentifierSetup. needsIdentifierSetup
  // 是 service 层派生 (email 与 phone 都 NULL → True), 不进 DB; 前端 router
  // guard 据此 push /complete-profile (单独原型, 未实现).
  readonly username?: string | null;
  // Phase B.5b: email + emailVerified 进 user summary. Profile 显示 chip
  // (verified/pending) + verify-email/send button. 老 user 没 email → null.
  readonly email?: string | null;
  readonly emailVerified?: boolean;
  readonly phone?: string | null;
  readonly phoneVerified?: boolean;
  readonly needsIdentifierSetup?: boolean;
  // Onboarding Phase 信号 (SIK-89 Home M-Auth, 2026-05-24): 用户是否走完
  // onboarding 流程. AuthGuard 在 user 已登录但 onboardingCompleted=false
  // 时落 BootCard 占位 (Onboarding Phase 未 ready); Onboarding Phase 启动
  // 后接管真正的跳转逻辑. 老 user 没有该字段 → undefined, 视为 true (放行,
  // 不打扰已登录老用户).
  readonly onboardingCompleted?: boolean;
  // DEV-only 标记 (SIK-89 Home M-Auth): 真实 prod 鉴权走 httpOnly auth_token
  // cookie + CSRF cookie, 这个字段只被 apps/web/src/main.tsx 的 DEV bypass
  // 设置 ('dev-bypass'), 受 import.meta.env.DEV 守卫, vite tree-shake 后 prod
  // bundle 不含字面量. 用于 grep 验证 tree-shake 生效.
  readonly accessToken?: string;
}

interface AuthState {
  readonly user: AuthUserSummary | null;
  // Post-Phase D P1-1: drop csrfToken field. CSRF 现 100% 走 cookie channel
  // (Set-Cookie + document.cookie read). 单一 source of truth, body 不再
  // 暴露 csrf_token 给浏览器扩展 / error logger.
  // Post-Phase D N1: sessionExpiresAt (epoch ms) 让 silent refresh timer
  // (lib/silent-refresh.ts) 知道何时需要 refresh cookie. 持久化让 SPA 重启
  // 后能立即重 schedule.
  readonly sessionExpiresAt: number | null;
  readonly setSession: (user: AuthUserSummary, expiresInSeconds?: number) => void;
  readonly clearSession: () => void;
  readonly isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      sessionExpiresAt: null,
      setSession: (user, expiresInSeconds = 0) =>
        set({
          user,
          sessionExpiresAt:
            expiresInSeconds > 0 ? Date.now() + expiresInSeconds * 1000 : null,
        }),
      clearSession: () => {
        set({ user: null, sessionExpiresAt: null });
        // 清 localStorage `sikao.auth` 持久化项 — 防 logout 后 user data 残留
        // (Phase F round 1 抓的 P1: 退出后 localStorage.sikao.auth 仍存在).
        // RedirectGuard 现在依赖 user == null 已 OK, 但残留 = 无意义状态 leak.
        // zustand persist v5 暴露 clearStorage() — 直接调最干净.
        useAuthStore.persist.clearStorage();
      },
      isAuthenticated: () => get().user !== null,
    }),
    {
      name: 'sikao.auth',
      storage: createJSONStorage(() => localStorage),
      // user + sessionExpiresAt 持久化. token + csrf 都在 cookie 里 (JS 可读
      // csrf, JS 不可读 token). isAuthenticated 是计算属性, 不存储.
      partialize: (s) => ({ user: s.user, sessionExpiresAt: s.sessionExpiresAt }),
    },
  ),
);
