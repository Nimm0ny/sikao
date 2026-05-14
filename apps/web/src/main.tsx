import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ToastHost } from '@sikao/shared-utils';
import { logger } from '@sikao/shared-utils';
import { shouldRetry } from '@sikao/shared-utils';
import { startSilentRefreshScheduler } from '@sikao/shared-utils';
import './index.css';

// Phase 3.6 fenbi-merge — D3 决策: 「考场态」三页 (答题/报告/申论考场/
// 申论评分) 才走 dark, 离开自动 light. 全站默认 light, 由 useApplyExamTheme
// 在考场态 view 守卫激活. (旧 Phase 4.3 全站偏好已退役)
//
// review-fix #6 防 flash: 用户 examTheme=dark 在考场态路由刷新页面时, React
// mount → effect 写 data-theme 是 first paint **之后**, 第一帧会闪 light.
// 这里在 createRoot 之前同步内联读 localStorage + 路径判断, 命中考场态 path
// 直接 setAttribute, 让首帧就是 dark. 旧 Phase 4.3 启动期 apply 全局 theme
// 出于同因, 这次改成只在考场态 path 激活.
const EXAM_PATHS = ['/practice/sessions/', '/practice/result/', '/essay/exam/', '/essay/grades/'];
function applyExamThemeOnBoot(): void {
  try {
    const path = window.location.pathname;
    if (!EXAM_PATHS.some((p) => path.startsWith(p))) return;
    const raw = window.localStorage.getItem('sikao.examTheme');
    if (raw === null) return;
    const parsed = JSON.parse(raw) as { state?: { examTheme?: 'light' | 'dark' } };
    const theme = parsed?.state?.examTheme;
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch {
    // localStorage 不可用 / JSON 损坏 — 默认 light, 第一帧 light 也只是不优雅,
    // 不影响功能 (effect 仍会修复). 不抛.
  }
}
applyExamThemeOnBoot();

// Post-Phase D N1: proactive silent refresh. Subscribes useAuthStore +
// reschedules timer on every sessionExpiresAt change. No-op if not logged in.
startSilentRefreshScheduler();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Sunday Polish (2026-05-08): 旧 `retry: 1` 让 4xx 业务错也 retry 1 次,
      // 用户多等 ~2s. 改用共享 shouldRetry: 4xx fail-fast / 5xx 仍 retry 2 次.
      // 各 hook 仍可 override (e.g. Home/Papers retry: false 完全禁).
      retry: shouldRetry,
      staleTime: 30_000,
    },
    mutations: {
      onError: (err: unknown) => {
        logger.error('react-query.mutation.error', { err: String(err) });
      },
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) {
  // Fail-fast: without a mount point the app cannot start.
  throw new Error('Mount point #root not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastHost />
    </QueryClientProvider>
  </StrictMode>,
);
