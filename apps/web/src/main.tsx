/*
 * Sikao Web — minimal V5-M0.5 skeleton (2026-05-24).
 *
 * Post big-bang rebuild this entry is intentionally minimal:
 *   - QueryClientProvider with the same retry/staleTime contract the project
 *     standardized in Home Phase (M7-M8). No refetch tuning beyond defaults.
 *   - RouterProvider with a placeholder router that only registers a single
 *     "/" route showing the V5-M0.5 boot card. Real routes land in V5-M3
 *     (35 component skeletons) and V5-M9 (page implementations).
 *   - ToastHost + silent refresh scheduler from @sikao/shared-utils so the
 *     SSOT auth + toast infrastructure is wired and ready for V5 views.
 *
 * Rules that still apply:
 *   - Fail-fast on missing #root mount point (AGENT-H7).
 *   - dev port 18080 (AGENT-H10), enforced by vite.config.ts.
 *   - No docker references (AGENT-H10).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ToastHost, logger, shouldRetry, startSilentRefreshScheduler } from '@sikao/shared-utils';
import { router } from './router';
import './index.css';

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

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastHost />
    </QueryClientProvider>
  </StrictMode>,
);
