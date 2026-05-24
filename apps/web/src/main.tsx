/*
 * Sikao Web — entry (V5-M0.5 skeleton + SIK-89 Home M-Auth bypass).
 *
 * Post big-bang rebuild this entry stays minimal:
 *   - QueryClientProvider with the same retry/staleTime contract Home
 *     Phase standardized (M7-M8). No refetch tuning beyond defaults.
 *   - RouterProvider + AuthGuard at the root (see router/index.tsx).
 *   - ToastHost + silent refresh scheduler from @sikao/shared-utils so the
 *     SSOT auth + toast infrastructure is wired and ready for V5 views.
 *
 * SIK-89 Home M-Auth (2026-05-24):
 *   - DEV bypass: pre-populates useAuthStore with a synthetic DEV_USER so
 *     `npm run dev` skips the AuthGuard placeholder and renders straight
 *     into RootLayout. Wrapped in `if (import.meta.env.DEV)` so vite
 *     tree-shakes the entire branch (DEV_USER literal + accessToken
 *     'dev-bypass' + onboardingCompleted: true) out of prod bundles.
 *     Acceptance gate: `grep -r 'DEV_USER\|dev-bypass\|onboardingCompleted'
 *     apps/web/dist/` must surface 0 hits after `npm run build`.
 *   - MSW worker boot: dynamic-imported only inside the DEV branch so
 *     prod bundles never reference the worker module.
 *
 * Rules that still apply:
 *   - Fail-fast on missing #root mount point (AGENT-H7).
 *   - Fail-fast: DEV_USER explicitly defines every field (id, displayName,
 *     email, onboardingCompleted, accessToken) — no `?? defaultValue` and
 *     no silent fallbacks.
 *   - dev port 18080 (AGENT-H10), enforced by vite.config.ts.
 *   - No docker references (AGENT-H10).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ToastHost, logger, shouldRetry, startSilentRefreshScheduler } from '@sikao/shared-utils';
import { useAuthStore } from '@sikao/domain';
import { router } from './router';
import './index.css';

// Why an async helper: vite build target is es2020, which doesn't support
// top-level await. The conventional MSW boot pattern is to gate render on
// the worker.start() promise so handlers are live before the first fetch.
async function bootstrapDevEnvironment(): Promise<void> {
  if (!import.meta.env.DEV) return;

  // DEV-only synthetic user. Defined inside the DEV branch so the literal
  // (including 'dev-bypass' and onboardingCompleted: true) gets DCE'd in
  // prod builds where `import.meta.env.DEV` is replaced with `false`.
  const DEV_USER = {
    id: -1,
    displayName: 'DEV',
    email: 'dev@local',
    onboardingCompleted: true,
    accessToken: 'dev-bypass',
  };
  useAuthStore.setState({ user: DEV_USER });

  // Dynamic import keeps msw/browser out of the prod chunk graph. The
  // worker only registers per-Tab MSW handlers (see src/mocks/handlers.ts).
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

// Subscribes to useAuthStore session expiry and reschedules silent refresh.
// No-op if the user is not logged in.
startSilentRefreshScheduler();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
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

void bootstrapDevEnvironment().then(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ToastHost />
      </QueryClientProvider>
    </StrictMode>,
  );
});
