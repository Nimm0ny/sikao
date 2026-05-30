import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { usePlanStore } from '@sikao/domain';

import { server } from '../../../mocks/server';
import { MonthCalendarView } from './MonthCalendarView';
import { createCalendarViewConfig } from './calendarViewConfig';

function renderWithClient(ui: ReactNode = <MonthCalendarView />) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const pad = (n: number) => String(n).padStart(2, '0');
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();
const fixedAnchor = '2026-05-30';

function makeEvent(id: string, title: string, day = today) {
  return {
    id,
    title,
    startAt: `${day}T09:00:00+08:00`,
    endAt: `${day}T10:00:00+08:00`,
    category: 'practice',
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
}

const response = (events: ReadonlyArray<unknown>) =>
  HttpResponse.json({
    data: { events, practiceBlocks: [] },
    meta: { from: '', to: '', tz: 'Asia/Shanghai', includePracticeBlocks: false },
  });

beforeEach(() => {
  usePlanStore.setState({
    currentView: 'week',
    currentDate: today,
    selectedRange: null,
  });
});

afterEach(() => {
  usePlanStore.setState({
    currentView: 'week',
    currentDate: today,
    selectedRange: null,
  });
  usePlanStore.getState().resetOptimisticEvents();
});

describe('MonthCalendarView', () => {
  it('renders the event chip in the matching day cell', async () => {
    server.use(http.get('/api/v2/plans/events', () => response([makeEvent('m1', 'Focused drill')])));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(1));
    const cell = screen.getByTestId(`home-month-cell-${today}`);
    expect(cell).toContainElement(screen.getByTestId('home-month-event'));
  });

  it('renders the aggregation microline on a month chip', async () => {
    server.use(
      http.get('/api/v2/plans/events', () => response([makeEvent('evt-yanyu-am', 'Focused drill')])),
      http.post('/api/v2/plans/events/aggregates', () =>
        HttpResponse.json({
          items: [
            {
              eventId: 'evt-yanyu-am',
              linkedSessionId: 2001,
              availability: 'ready',
              metrics: {
                attemptedCount: 30,
                correctCount: 18,
                accuracy: 0.6,
                activeSeconds: 1500,
                sourceKind: 'practice_session',
              },
            },
          ],
        }),
      ),
    );
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByTestId('home-month-event-aggregate')).toHaveTextContent('练 30 · 准 60%'),
    );
  });

  it('renders a 21-cell rolling window from the anchor week start', async () => {
    usePlanStore.setState({ currentDate: fixedAnchor });
    server.use(http.get('/api/v2/plans/events', () => response([makeEvent('m1', 'Anchor event', fixedAnchor)])));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(1));
    expect(screen.getAllByRole('gridcell')).toHaveLength(21);
    expect(screen.getByTestId('home-month-cell-2026-05-25')).toBeInTheDocument();
    expect(screen.getByTestId('home-month-cell-2026-06-14')).toBeInTheDocument();
  });

  it('renders all events and removes the +N overflow label', async () => {
    const events = Array.from({ length: 5 }, (_, i) => makeEvent(`m${i}`, `Event ${i}`));
    server.use(http.get('/api/v2/plans/events', () => response(events)));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(5));
    expect(screen.queryByTestId('home-month-overflow')).not.toBeInTheDocument();
    expect(screen.getByTestId(`home-month-event-list-${today}`)).toHaveAttribute('data-scrollable', 'true');
  });

  it('uses cardLimitPerCell to size the visible month list window', async () => {
    const events = Array.from({ length: 5 }, (_, i) => makeEvent(`m${i}`, `Event ${i}`));
    server.use(http.get('/api/v2/plans/events', () => response(events)));
    renderWithClient(
      <MonthCalendarView
        viewConfig={createCalendarViewConfig({ view: 'month', cardLimitPerCell: 2 })}
      />,
    );
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(5));
    expect(screen.getByTestId(`home-month-event-list-${today}`)).toHaveStyle({
      maxHeight: 'calc(2 * var(--space-8) + 1 * var(--space-1))',
    });
  });

  it('keeps a non-overflowing list non-scrollable', async () => {
    server.use(http.get('/api/v2/plans/events', () => response([makeEvent('m1', 'Only one')])));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(1));
    expect(screen.getByTestId(`home-month-event-list-${today}`)).not.toHaveAttribute('data-scrollable');
  });

  it('renders Sunday-first DOW labels when startWeekOnMonday=false', async () => {
    usePlanStore.setState({ currentDate: fixedAnchor });
    let seenFrom = '';
    let seenTo = '';
    server.use(
      http.get('/api/v2/plans/events', ({ request }) => {
        const params = new URL(request.url).searchParams;
        seenFrom = params.get('from') ?? '';
        seenTo = params.get('to') ?? '';
        return response([makeEvent('m1', 'Sunday event', '2026-05-24')]);
      }),
    );
    renderWithClient(
      <MonthCalendarView
        viewConfig={createCalendarViewConfig({ view: 'month', startWeekOnMonday: false })}
      />,
    );
    await waitFor(() => expect(screen.getAllByRole('columnheader')).toHaveLength(7));
    const labels = screen.getAllByRole('columnheader').map((el) => el.textContent);
    expect(labels).toEqual(['日', '一', '二', '三', '四', '五', '六']);
    expect(screen.getAllByRole('gridcell')).toHaveLength(21);
    expect(screen.getByTestId('home-month-cell-2026-05-24')).toContainElement(
      screen.getByTestId('home-month-event'),
    );
    expect(screen.getByTestId('home-month-cell-2026-06-13')).toBeInTheDocument();
    expect(seenFrom).toBe('2026-05-23T16:00:00.000Z');
    expect(seenTo).toBe('2026-06-13T16:00:00.000Z');
  });

  it('renders EmptyState when API returns []', async () => {
    server.use(http.get('/api/v2/plans/events', () => response([])));
    renderWithClient();
    await waitFor(() => expect(screen.getByTestId('home-month-empty')).toBeInTheDocument());
  });

  it('renders EmptyState when recurring events project to zero visible slices', async () => {
    usePlanStore.setState({ currentDate: '2026-05-15' });
    const skippedRecurring = {
      ...makeEvent('r-empty', 'Skipped recurring', '2026-05-15'),
      recurringRule: 'RRULE:FREQ=DAILY;COUNT=1',
      recurringExceptionDates: ['2026-05-15'],
    };
    server.use(http.get('/api/v2/plans/events', () => response([skippedRecurring])));
    renderWithClient();
    await waitFor(() => expect(screen.getByTestId('home-month-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('home-month-event')).not.toBeInTheDocument();
  });

  it('renders ErrorCard on 500', async () => {
    server.use(http.get('/api/v2/plans/events', () => HttpResponse.json({}, { status: 500 })));
    renderWithClient();
    await waitFor(() => expect(screen.getByTestId('home-month-error')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('renders Skeleton while the query is in flight', async () => {
    server.use(
      http.get('/api/v2/plans/events', async () => {
        await delay(50);
        return response([]);
      }),
    );
    renderWithClient();
    expect(screen.getByTestId('home-month-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('home-month-loading')).not.toBeInTheDocument());
  });

  it('expands a daily recurring event into one chip per occurrence', async () => {
    usePlanStore.setState({ currentDate: '2026-05-15' });
    const recurring = {
      ...makeEvent('r1', 'Daily recap', '2026-05-15'),
      recurringRule: 'RRULE:FREQ=DAILY;COUNT=3',
    };
    server.use(http.get('/api/v2/plans/events', () => response([recurring])));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(3));
  });
});

describe('MonthCalendarView optimistic anchors', () => {
  it('stamps data-event-id + data-peek-anchor on each rendered chip', async () => {
    server.use(http.get('/api/v2/plans/events', () => response([makeEvent('m1', 'Focused drill')])));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(1));
    const chip = screen.getByTestId('home-month-event');
    expect(chip).toHaveAttribute('data-event-id', 'm1');
    const anchor = chip.getAttribute('data-peek-anchor');
    expect(anchor).toContain('m1');
    expect(anchor).not.toBe('m1');
  });

  it('renders the optimistic patch title when the store holds a patch', async () => {
    usePlanStore.getState().upsertOptimisticEvent('m1', { title: 'Optimistic preview' });
    server.use(http.get('/api/v2/plans/events', () => response([makeEvent('m1', 'Original title')])));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(1));
    expect(screen.getByTestId('home-month-event-title')).toHaveTextContent('Optimistic preview');
  });

  it('renders an optimistic-only event before refetch lands', async () => {
    usePlanStore.getState().upsertOptimisticEvent('m-opt', {
      id: 'm-opt',
      title: 'Optimistic preview',
      startAt: `${today}T18:00:00+08:00`,
      endAt: `${today}T18:20:00+08:00`,
      category: 'custom',
      status: 'planned',
      source: 'ai_generated',
      timezone: 'Asia/Shanghai',
      notes: 'Generated from recommendation',
    });
    server.use(http.get('/api/v2/plans/events', () => response([])));
    renderWithClient();
    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(1));
    expect(screen.getByTestId('home-month-event-title')).toHaveTextContent('Optimistic preview');
  });
});
