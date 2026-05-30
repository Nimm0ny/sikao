/*
 * RecentPracticeSection tests — SIK-143 W6.
 * Covers ready render + the data-scrollable contract the bottom-fade CSS
 * keys off (contract §3.1: 最近练习 cap=1 → scroll + fade when items exceed).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { RecentPracticeSection } from './RecentPracticeSection';

function renderWithEnv() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <RecentPracticeSection />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const RECORD_1 = {
  id: 'r1',
  kind: 'xingce_practice',
  title: '行测真题 · 2024 国考',
  occurredAt: '2026-05-24T08:00:00Z',
  score: '76.5',
  status: 'done',
  href: '/practice/sessions/6001/result',
};
const RECORD_2 = {
  id: 'r2',
  kind: 'essay_submission',
  title: '申论真题 · 2024 联考',
  occurredAt: '2026-05-22T08:00:00Z',
  score: '82',
  status: 'done',
  href: '/practice/sessions/6002/grading',
};

beforeEach(() => {
  // RecentPracticeSection fetches { page: 1, size: 2 }; default handler in
  // tests is overridden per-case below.
});

describe('RecentPracticeSection (SIK-143 W6)', () => {
  it('ready: renders bc-head 最近练习 + 全部历史 link + items', async () => {
    server.use(
      http.get('/api/v2/profile/records', () =>
        HttpResponse.json({ items: [RECORD_1, RECORD_2], page: 1, pageSize: 2, total: 12 }),
      ),
    );
    renderWithEnv();
    await waitFor(() => expect(screen.getAllByTestId('home-recent-item')).toHaveLength(2));
    expect(screen.getByRole('heading', { name: '最近练习', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '全部历史' })).toHaveAttribute('href', '/profile/records');
  });

  it('marks the feed list scrollable when items exceed the visible cap (>1)', async () => {
    // 2 items > cap 1 → list opts into scroll + bottom-fade (data-scrollable).
    server.use(
      http.get('/api/v2/profile/records', () =>
        HttpResponse.json({ items: [RECORD_1, RECORD_2], page: 1, pageSize: 2, total: 12 }),
      ),
    );
    renderWithEnv();
    await waitFor(() => expect(screen.getAllByTestId('home-recent-item')).toHaveLength(2));
    const list = screen.getByTestId('home-recent-practice').querySelector('ul');
    expect(list).toHaveAttribute('data-scrollable', 'true');
  });

  it('does not mark scrollable when within the visible cap (<=1)', async () => {
    server.use(
      http.get('/api/v2/profile/records', () =>
        HttpResponse.json({ items: [RECORD_1], page: 1, pageSize: 2, total: 1 }),
      ),
    );
    renderWithEnv();
    await waitFor(() => expect(screen.getAllByTestId('home-recent-item')).toHaveLength(1));
    const list = screen.getByTestId('home-recent-practice').querySelector('ul');
    expect(list).not.toHaveAttribute('data-scrollable');
  });
});
