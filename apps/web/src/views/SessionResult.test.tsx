import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { server } from '../mocks/server';
import { SessionResult } from './SessionResult';

function renderSessionResult() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [{ path: '/practice/sessions/:sessionId/result', element: <SessionResult /> }],
    { initialEntries: ['/practice/sessions/6001/result'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('SessionResult', () => {
  it('renders summary, timing success state, and lifecycle timeline', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId/lifecycle', () =>
        HttpResponse.json({
          status: 'submitted',
          pausedCount: 1,
          pausedTotalSeconds: 300,
          transitions: [
            {
              fromStatus: 'draft',
              toStatus: 'in_progress',
              trigger: 'user_start',
              actor: 'user',
              ts: '2026-05-24T08:00:00Z',
              reason: null,
            },
            {
              fromStatus: 'in_progress',
              toStatus: 'submitted',
              trigger: 'user_submit',
              actor: 'user',
              ts: '2026-05-24T09:00:00Z',
              reason: null,
            },
          ],
        }),
      ),
    );

    renderSessionResult();
    expect(await screen.findByTestId('session-result-view')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Timing')).toBeInTheDocument();
    expect(screen.getByText('Total active seconds: 180')).toBeInTheDocument();
    expect(screen.getByText('Lifecycle')).toBeInTheDocument();
    expect(screen.getByText('draft -> in_progress')).toBeInTheDocument();
  });

  it('renders a timing error state instead of pretending the panel is empty', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId/timing-report', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 403 }),
      ),
    );

    renderSessionResult();
    expect(await screen.findByTestId('session-result-view')).toBeInTheDocument();
    expect(await screen.findByText('Timing load failed')).toBeInTheDocument();
  });

  it('renders an empty sections state when the result has no sections', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId/result', () =>
        HttpResponse.json({
          summary: [
            { key: 'track', label: 'Track', value: 'essay', tone: 'neutral' },
          ],
          sections: [],
          actions: [],
        }),
      ),
    );

    renderSessionResult();
    expect(await screen.findByTestId('session-result-view')).toBeInTheDocument();
    expect(screen.getByText('No result sections')).toBeInTheDocument();
  });

  it('renders a lifecycle error state when transitions cannot be loaded', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId/lifecycle', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 403 }),
      ),
    );

    renderSessionResult();
    expect(await screen.findByTestId('session-result-view')).toBeInTheDocument();
    expect(await screen.findByText('Lifecycle load failed')).toBeInTheDocument();
  });
});
