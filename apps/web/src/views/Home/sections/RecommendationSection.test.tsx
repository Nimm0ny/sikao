/*
 * RecommendationSection tests — SIK-92 Home M-C (2026-05-26).
 * Covers ready / empty / error / loading + accept(session) + reject flow.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../../mocks/server';
import { RecommendationSection } from './RecommendationSection';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: vi.fn() };
});

function renderWithEnv() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <RecommendationSection />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const SAMPLE_RECS = [
  {
    id: 1, title: '言语理解 · 主旨题专项', actionType: 'practice',
    cta: '开始练习', estimatedMinutes: 20, expiresAt: '2026-05-25T00:00:00Z',
    generatedAt: '2026-05-24T08:00:00Z', servedCount: 1, status: 'served',
    reason: '近 7 天主旨题正确率 58%，低于目标 70%',
    payload: {}, sourceSignals: {}, llmCallId: null,
    acceptedAt: null, rejectedAt: null,
  },
];

describe('RecommendationSection (SIK-92)', () => {
  it('ready: renders feed-item cards with title + pill', async () => {
    server.use(http.get('/api/v2/recommendations/today', () =>
      HttpResponse.json({ items: SAMPLE_RECS, total: SAMPLE_RECS.length }),
    ));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-recommendation')).toBeInTheDocument());
    expect(screen.getByText('言语理解 · 主旨题专项')).toBeInTheDocument();
    expect(screen.getByTestId('home-recommendation-1').querySelector('button')).not.toBeNull();
  });

  it('empty: renders EmptyState + refresh CTA', async () => {
    server.use(http.get('/api/v2/recommendations/today', () => HttpResponse.json({ items: [], total: 0 })));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-recommendation-empty')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '刷新推荐' })).toBeInTheDocument();
  });

  it('error: renders EmptyState on 500', async () => {
    server.use(http.get('/api/v2/recommendations/today', () => HttpResponse.json({}, { status: 500 })));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-recommendation-error')).toBeInTheDocument());
  });

  it('loading: renders Skeleton while in flight', async () => {
    server.use(http.get('/api/v2/recommendations/today', async () => {
      await delay(50);
      return HttpResponse.json({ items: [], total: 0 });
    }));
    renderWithEnv();
    expect(screen.getByTestId('home-recommendation-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('home-recommendation-loading')).not.toBeInTheDocument());
  });

  it('accept(session): feed-item click opens AcceptOptionMenu, 立即开始 navigates', async () => {
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    server.use(
      http.get('/api/v2/recommendations/today', () =>
        HttpResponse.json({ items: SAMPLE_RECS, total: 1 }),
      ),
      http.post('/api/v2/recommendations/:id/accept', () =>
        HttpResponse.json({
          recommendationId: 1, status: 'accepted',
          sessionId: 9001, eventId: null, redirectUrl: null,
        }),
      ),
    );
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-recommendation-1')).toBeInTheDocument());
    const feedButton = screen.getByTestId('home-recommendation-1').querySelector('button');
    await userEvent.click(feedButton!);
    await waitFor(() => expect(screen.getByTestId('accept-option-menu')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '立即开始' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/practice/sessions/9001'));
  });

  it('reject: feed-item -> AcceptOptionMenu -> 不感兴趣 -> RejectFeedbackDialog -> submit', async () => {
    let receivedBody: { reason?: string; note?: string | null } | null = null;
    server.use(
      http.get('/api/v2/recommendations/today', () =>
        HttpResponse.json({ items: SAMPLE_RECS, total: 1 }),
      ),
      http.post('/api/v2/recommendations/:id/reject', async ({ request }) => {
        receivedBody = (await request.json()) as { reason?: string; note?: string | null };
        return HttpResponse.json({ ok: true, status: 'rejected' });
      }),
    );
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-recommendation-1')).toBeInTheDocument());
    const feedButton = screen.getByTestId('home-recommendation-1').querySelector('button');
    await userEvent.click(feedButton!);
    await waitFor(() => expect(screen.getByTestId('accept-option-reject')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('accept-option-reject'));
    await waitFor(() => expect(screen.getByTestId('reject-feedback')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('reject-reason-too-easy'));
    await userEvent.click(screen.getByRole('button', { name: '提交反馈' }));
    await waitFor(() => expect(receivedBody?.reason).toBe('too-easy'));
  });
});
