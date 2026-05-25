/*
 * WeekCalendarView tests — SIK-90 Home M-A wave 2 (2026-05-24).
 * 4-state coverage via per-test MSW handler injection.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../../mocks/server';
import { WeekCalendarView } from './WeekCalendarView';

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <WeekCalendarView />
    </QueryClientProvider>,
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

const READY_EVENT = {
  id: 'we1', title: '行测模考', startAt: `${today}T09:00:00+08:00`, endAt: `${today}T11:00:00+08:00`,
  category: 'mock', status: 'planned', source: 'manual', timezone: 'Asia/Shanghai',
  notes: '', planId: 1, isRecurringInstance: false, deletedAt: null, linkedSessionId: null,
  parentId: null, recurringExceptionDates: [], recurringParentId: null, recurringRule: null, targetId: null,
} as const;

const r = (events: ReadonlyArray<unknown>) => HttpResponse.json({
  data: { events, practiceBlocks: [] },
  meta: { from: '', to: '', tz: 'Asia/Shanghai', includePracticeBlocks: false },
});

describe('WeekCalendarView (Home M-A wave 2)', () => {
  it('ready: renders event in matching day column', async () => {
    server.use(http.get('/api/v2/plans/events', () => r([READY_EVENT])));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-week-event')).toHaveLength(1));
    expect(screen.getByTestId(`home-week-day-${today}`)).toContainElement(screen.getByTestId('home-week-event'));
  });

  it('empty: renders EmptyState when API returns []', async () => {
    server.use(http.get('/api/v2/plans/events', () => r([])));
    renderWithClient();
    await waitFor(() => expect(screen.getByTestId('home-week-empty')).toBeInTheDocument());
  });

  it('error: renders ErrorCard on 500', async () => {
    server.use(http.get('/api/v2/plans/events', () => HttpResponse.json({}, { status: 500 })));
    renderWithClient();
    await waitFor(() => expect(screen.getByTestId('home-week-error')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('loading: renders Skeleton stack while in flight', async () => {
    server.use(http.get('/api/v2/plans/events', async () => { await delay(50); return r([]); }));
    renderWithClient();
    expect(screen.getByTestId('home-week-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('home-week-loading')).not.toBeInTheDocument());
  });
});
