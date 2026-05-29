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
import { createCalendarViewConfig } from './calendarViewConfig';

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
  it('ready: renders event in matching day cell (early slot for 09:00 event)', async () => {
    server.use(http.get('/api/v2/plans/events', () => r([READY_EVENT])));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-week-event')).toHaveLength(1));
    // 09:00 falls in slot 0 (早上 06-12); the chip lives in the cell for
    // today + slot 0.
    expect(screen.getByTestId(`home-week-cell-${today}-0`)).toContainElement(
      screen.getByTestId('home-week-event'),
    );
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

  it('reuses MonthEventChip read-only (renders home-month-event, not draggable)', async () => {
    server.use(http.get('/api/v2/plans/events', () => r([READY_EVENT])));
    renderWithClient();
    // SIK-142 W1: the week chip is now MonthEventChip (data-testid
    // home-month-event), reused read-only — no dnd draggable attributes and
    // no onClick wiring (W5 will add the Peek). It still carries the tone
    // data-attr so the time-status color channel renders.
    await waitFor(() => expect(screen.getByTestId('home-month-event')).toBeInTheDocument());
    const chip = screen.getByTestId('home-month-event');
    expect(chip).toHaveAttribute('data-tone');
    expect(chip).not.toHaveAttribute('aria-roledescription', 'draggable');
    expect(chip).not.toHaveAttribute('data-dragging');
  });

  it('renders Sunday-first DOW labels when startWeekOnMonday=false', async () => {
    server.use(http.get('/api/v2/plans/events', () => r([READY_EVENT])));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <WeekCalendarView
          viewConfig={createCalendarViewConfig({ view: 'week', startWeekOnMonday: false })}
        />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByRole('columnheader')).toHaveLength(7));
    const labels = screen
      .getAllByRole('columnheader')
      // Strip the per-day numeric DOM and the today suffix so the order
      // assertion is stable regardless of which weekday we render on.
      .map((el) => (el.querySelector('span:first-child')?.textContent ?? '').replace(' · 今日', ''));
    expect(labels).toEqual(['周日', '周一', '周二', '周三', '周四', '周五', '周六']);
  });
});
