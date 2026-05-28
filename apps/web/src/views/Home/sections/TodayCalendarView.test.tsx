/*
 * TodayCalendarView tests — SIK-90 Home M-A wave 1 commit 2 (2026-05-24).
 * Cover the 4-state contract via per-test MSW handler injection (loading
 * via delay, ready via 200, empty via 200 + empty list, error via 500).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../../mocks/server';
import { TodayCalendarView } from './TodayCalendarView';

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TodayCalendarView />
    </QueryClientProvider>,
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

const READY_EVENT = {
  id: 'e1',
  title: '言语理解 · 30 题',
  startAt: `${today}T08:00:00+08:00`,
  endAt: `${today}T10:00:00+08:00`,
  category: 'yanyu',
  status: 'planned',
  source: 'manual',
  timezone: 'Asia/Shanghai',
  notes: '',
  planId: 1,
  isRecurringInstance: false,
  deletedAt: null,
  linkedSessionId: null,
  parentId: null,
  recurringExceptionDates: [],
  recurringParentId: null,
  recurringRule: null,
  targetId: null,
} as const;

function eventsResponse(events: ReadonlyArray<typeof READY_EVENT>) {
  return HttpResponse.json({
    data: { events, practiceBlocks: [] },
    meta: { from: '', to: '', tz: 'Asia/Shanghai', includePracticeBlocks: false },
  });
}

describe('TodayCalendarView (Home M-A wave 1 commit 2)', () => {
  it('ready: renders event blocks when the API returns events', async () => {
    server.use(http.get('/api/v2/plans/events', () => eventsResponse([READY_EVENT])));
    renderWithClient();
    await waitFor(() => {
      expect(screen.getAllByTestId('home-today-event')).toHaveLength(1);
    });
    expect(screen.getByText('言语理解 · 30 题')).toBeInTheDocument();
  });

  it('empty: renders EmptyState when the list is empty', async () => {
    server.use(http.get('/api/v2/plans/events', () => eventsResponse([])));
    renderWithClient();
    await waitFor(() => {
      expect(screen.getByTestId('home-today-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('今日尚无事件')).toBeInTheDocument();
  });

  it('error: renders ErrorCard with retry CTA when the API returns 500', async () => {
    server.use(http.get('/api/v2/plans/events', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })));
    renderWithClient();
    await waitFor(() => {
      expect(screen.getByTestId('home-today-error')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('loading: renders Skeleton stack while the request is in flight', async () => {
    server.use(http.get('/api/v2/plans/events', async () => {
      await delay(50);
      return eventsResponse([]);
    }));
    renderWithClient();
    expect(screen.getByTestId('home-today-loading')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('home-today-loading')).not.toBeInTheDocument();
    });
  });
});
