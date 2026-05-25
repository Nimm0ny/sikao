/*
 * RecommendationSection tests — SIK-92 Home M-C wave 1 (2026-05-24).
 * Covers ready / empty / error / loading + accept(session) navigation.
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

describe('RecommendationSection (Home M-C wave 1)', () => {
  it('ready: renders cards with accept + reject CTAs', async () => {
    server.use(http.get('/api/v2/recommendations/today', () =>
      HttpResponse.json({ items: SAMPLE_RECS, total: SAMPLE_RECS.length }),
    ));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-recommendation')).toBeInTheDocument());
    expect(screen.getByText('言语理解 · 主旨题专项')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始练习' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '不感兴趣' })).toBeInTheDocument();
  });

  it('empty: renders EmptyState + refresh CTA when API returns []', async () => {
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

  it('loading: renders Skeleton stack while in flight', async () => {
    server.use(http.get('/api/v2/recommendations/today', async () => {
      await delay(50);
      return HttpResponse.json({ items: [], total: 0 });
    }));
    renderWithEnv();
    expect(screen.getByTestId('home-recommendation-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('home-recommendation-loading')).not.toBeInTheDocument());
  });

  it('accept(session): navigates to /practice/sessions/:id on success', async () => {
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
    await waitFor(() => expect(screen.getByRole('button', { name: '开始练习' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '开始练习' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/practice/sessions/9001'));
  });
});
