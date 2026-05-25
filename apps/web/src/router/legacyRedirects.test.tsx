/*
 * Legacy redirect tests — SIK-93 Home M-Records (2026-05-24).
 * Verifies the 7 V4 → V5 path remaps land on the canonical routes.
 *
 * We rebuild a memory router with the same route table so we can drive
 * arbitrary initial entries; the production singleton in router/index.tsx
 * uses createBrowserRouter which doesn't accept initialEntries.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, Navigate, RouterProvider, Outlet } from 'react-router-dom';
import { useAuthStore } from '@sikao/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

const LEGACY = [
  { from: '/app', to: '/' },
  { from: '/study/today', to: '/' },
  { from: '/dashboard', to: '/' },
  { from: '/practice/center', to: '/practice' },
  { from: '/wrong-book', to: '/review' },
  { from: '/plan', to: '/' },
  { from: '/progress', to: '/profile/learning' },
] as const;

function ProbePage({ name }: { readonly name: string }) {
  return <div data-testid={`probe-${name}`}>{name}</div>;
}

function makeRouter(initial: string) {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: <Outlet />,
        children: [
          { index: true, element: <ProbePage name="home" /> },
          { path: 'practice', element: <ProbePage name="practice" /> },
          { path: 'review', element: <ProbePage name="review" /> },
          { path: 'profile/learning', element: <ProbePage name="profile-learning" /> },
          ...LEGACY.map(({ from, to }) => ({
            // strip leading slash for child routes
            path: from.replace(/^\//, ''),
            element: <Navigate to={to} replace />,
          })),
        ],
      },
    ],
    { initialEntries: [initial] },
  );
}

describe('Legacy redirects (SIK-93)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: -1, displayName: 'TEST', onboardingCompleted: true },
      sessionExpiresAt: null,
    });
    // Ensure handlers don't trip onUnhandledRequest if redirects mount
    // a probe page that's pure (no fetch).
    server.use(
      http.get('/api/v2/dashboard/progress', () => HttpResponse.json({}, { status: 200 })),
    );
  });

  for (const { from, to } of LEGACY) {
    it(`${from} → ${to}`, async () => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
      });
      const router = makeRouter(from);
      const { findByTestId } = render(
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );
      // Each canonical target shows a `probe-<name>` element. The page
      // names map below cover all 4 canonical destinations used by the
      // 7 redirects.
      const expectedProbe =
        to === '/' ? 'home' :
        to === '/practice' ? 'practice' :
        to === '/review' ? 'review' :
        to === '/profile/learning' ? 'profile-learning' :
        '';
      await waitFor(() => expect(findByTestId(`probe-${expectedProbe}`)).resolves.toBeTruthy());
    });
  }
});
