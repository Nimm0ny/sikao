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
  it('renders summary and timing success state', async () => {
    renderSessionResult();
    expect(await screen.findByTestId('session-result-view')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Timing')).toBeInTheDocument();
    expect(screen.getByText('Total active seconds: 180')).toBeInTheDocument();
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
});
