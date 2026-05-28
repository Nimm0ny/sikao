/*
 * MonthCalendarView tests — SIK-90 Home M-A wave 2 commit 2 (2026-05-24).
 * 4-state coverage + overflow chip "+N 更多" assertion.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../../mocks/server';
import { MonthCalendarView } from './MonthCalendarView';
import { createCalendarViewConfig } from './calendarViewConfig';

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MonthCalendarView />
    </QueryClientProvider>,
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

function makeEvent(id: string, title: string) {
  return {
    id, title,
    startAt: `${today}T09:00:00+08:00`, endAt: `${today}T10:00:00+08:00`,
    category: 'practice', status: 'planned', source: 'manual',
    timezone: 'Asia/Shanghai', notes: '', planId: 1, isRecurringInstance: false,
    deletedAt: null, linkedSessionId: null, parentId: null,
    recurringExceptionDates: [], recurringParentId: null, recurringRule: null, targetId: null,
  } as const;
}

const r = (events: ReadonlyArray<unknown>) => HttpResponse.json({
  data: { events, practiceBlocks: [] },
  meta: { from: '', to: '', tz: 'Asia/Shanghai', includePracticeBlocks: false },
});

describe('MonthCalendarView (Home M-A wave 2 commit 2)', () => {
  it('ready: renders event chip in matching day cell', async () => {
    server.use(http.get('/api/v2/plans/events', () => r([makeEvent('m1', '专项练习')])));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(1));
    const cell = screen.getByTestId(`home-month-cell-${today}`);
    expect(cell).toContainElement(screen.getByTestId('home-month-event'));
  });

  it('overflow: caps chips at 3 and renders "+N 更多" label', async () => {
    const events = Array.from({ length: 5 }, (_, i) => makeEvent(`m${i}`, `Event ${i}`));
    server.use(http.get('/api/v2/plans/events', () => r(events)));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(3));
    const overflow = screen.getByTestId('home-month-overflow');
    expect(overflow).toHaveTextContent('+2');
    expect(overflow).toHaveTextContent('更多');
  });

  it('honors a custom cardLimitPerCell from viewConfig', async () => {
    const events = Array.from({ length: 5 }, (_, i) => makeEvent(`m${i}`, `Event ${i}`));
    server.use(http.get('/api/v2/plans/events', () => r(events)));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <MonthCalendarView
          viewConfig={createCalendarViewConfig({ view: 'month', cardLimitPerCell: 2 })}
        />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(2));
    expect(screen.getByTestId('home-month-overflow')).toHaveTextContent('+3');
  });

  it('renders Sunday-first DOW labels when startWeekOnMonday=false', async () => {
    server.use(http.get('/api/v2/plans/events', () => r([makeEvent('m1', 'Event')])));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <MonthCalendarView
          viewConfig={createCalendarViewConfig({ view: 'month', startWeekOnMonday: false })}
        />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByRole('columnheader')).toHaveLength(7));
    const dowLabels = screen.getAllByRole('columnheader').map((el) => el.textContent);
    expect(dowLabels).toEqual(['日', '一', '二', '三', '四', '五', '六']);
  });

  it('empty: renders EmptyState when API returns []', async () => {
    server.use(http.get('/api/v2/plans/events', () => r([])));
    renderWithClient();
    await waitFor(() => expect(screen.getByTestId('home-month-empty')).toBeInTheDocument());
  });

  it('error: renders ErrorCard on 500', async () => {
    server.use(http.get('/api/v2/plans/events', () => HttpResponse.json({}, { status: 500 })));
    renderWithClient();
    await waitFor(() => expect(screen.getByTestId('home-month-error')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('loading: renders Skeleton while in flight', async () => {
    server.use(http.get('/api/v2/plans/events', async () => { await delay(50); return r([]); }));
    renderWithClient();
    expect(screen.getByTestId('home-month-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('home-month-loading')).not.toBeInTheDocument());
  });
});
