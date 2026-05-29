import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { delay, http, HttpResponse } from 'msw';

import { server } from '../../../mocks/server';
import { createCalendarViewConfig } from './calendarViewConfig';
import { WeekCalendarView } from './WeekCalendarView';

function renderWithClient(ui: ReactNode = <WeekCalendarView />) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const pad = (n: number) => String(n).padStart(2, '0');
const today = (() => {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
})();

const READY_EVENT = {
  id: 'we1',
  title: '行测模考',
  startAt: `${today}T09:00:00+08:00`,
  endAt: `${today}T11:00:00+08:00`,
  category: 'mock',
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

const response = (events: ReadonlyArray<unknown>) =>
  HttpResponse.json({
    data: { events, practiceBlocks: [] },
    meta: { from: '', to: '', tz: 'Asia/Shanghai', includePracticeBlocks: false },
  });

describe('WeekCalendarView', () => {
  it('renders the event in the matching early slot cell', async () => {
    server.use(http.get('/api/v2/plans/events', () => response([READY_EVENT])));
    renderWithClient();

    await waitFor(() => expect(screen.getAllByTestId('home-week-event')).toHaveLength(1));
    expect(screen.getByTestId(`home-week-cell-${today}-0`)).toContainElement(
      screen.getByTestId('home-week-event'),
    );
  });

  it('renders all same-slot events and marks the list scrollable once it exceeds 3', async () => {
    const events = Array.from({ length: 4 }, (_, index) => ({
      ...READY_EVENT,
      id: `we${index + 1}`,
      title: `Event ${index + 1}`,
      startAt: `${today}T09:0${index}:00+08:00`,
      endAt: `${today}T09:3${index}:00+08:00`,
    }));
    server.use(http.get('/api/v2/plans/events', () => response(events)));
    renderWithClient();

    await waitFor(() => expect(screen.getAllByTestId('home-week-event')).toHaveLength(4));
    expect(screen.getByTestId(`home-week-event-list-${today}-0`)).toHaveAttribute('data-scrollable', 'true');
  });

  it('uses cardLimitPerCell to size the visible week list window', async () => {
    const events = Array.from({ length: 4 }, (_, index) => ({
      ...READY_EVENT,
      id: `we${index + 1}`,
      title: `Event ${index + 1}`,
      startAt: `${today}T09:0${index}:00+08:00`,
      endAt: `${today}T09:3${index}:00+08:00`,
    }));
    server.use(http.get('/api/v2/plans/events', () => response(events)));
    renderWithClient(
      <WeekCalendarView viewConfig={createCalendarViewConfig({ view: 'week', cardLimitPerCell: 2 })} />,
    );

    await waitFor(() => expect(screen.getAllByTestId('home-week-event')).toHaveLength(4));
    expect(screen.getByTestId(`home-week-event-list-${today}-0`)).toHaveStyle({
      maxHeight: 'calc(2 * var(--space-8) + 1 * var(--space-1))',
    });
  });

  it('reuses MonthEventChip read-only', async () => {
    server.use(http.get('/api/v2/plans/events', () => response([READY_EVENT])));
    renderWithClient();

    await waitFor(() => expect(screen.getByTestId('home-month-event')).toBeInTheDocument());
    const chip = screen.getByTestId('home-month-event');
    expect(chip).toHaveAttribute('data-tone');
    expect(chip).not.toHaveAttribute('aria-roledescription', 'draggable');
    expect(chip).not.toHaveAttribute('data-dragging');
  });

  it('opens the fully-editable peek when a week chip is clicked', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        '/api/v2/plans/events',
        () =>
          response([
            {
              ...READY_EVENT,
              notes: 'Week peek note',
              targetId: 23,
              linkedSessionId: 9,
            },
          ]),
      ),
      http.post('/api/v2/plans/events/aggregates', () =>
        HttpResponse.json({
          items: [
            {
              eventId: READY_EVENT.id,
              linkedSessionId: 9,
              availability: 'ready',
              metrics: {
                attemptedCount: 12,
                correctCount: 9,
                accuracy: 0.75,
                activeSeconds: 1800,
                sourceKind: 'mock_exam',
              },
            },
          ],
        }),
      ),
    );
    renderWithClient();

    await waitFor(() => expect(screen.getByTestId('home-month-event')).toBeInTheDocument());
    await user.click(screen.getByTestId('home-month-event'));
    await waitFor(() => expect(screen.getByTestId('home-calendar-peek-card')).toBeInTheDocument());

    expect(screen.queryByTestId('home-calendar-peek-readonly-banner')).toBeNull();
    expect(screen.getByTestId('home-calendar-peek-source')).toBeInTheDocument();
    expect(screen.getByTestId('home-calendar-peek-target')).toBeInTheDocument();
    expect(screen.getByTestId('home-calendar-peek-linked')).toBeInTheDocument();
    expect(screen.getByTestId('home-calendar-peek-notes')).toBeInTheDocument();
    expect(screen.getByTestId('home-calendar-peek-aggregation')).toHaveTextContent('练习量');
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders an explicit aggregation empty state in peek', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/v2/plans/events', () => response([{ ...READY_EVENT, id: 'agg-empty' }])),
      http.post('/api/v2/plans/events/aggregates', () =>
        HttpResponse.json({
          items: [
            {
              eventId: 'agg-empty',
              linkedSessionId: 901,
              availability: 'not_submitted',
              metrics: null,
            },
          ],
        }),
      ),
    );
    renderWithClient();

    await waitFor(() => expect(screen.getByTestId('home-month-event')).toBeInTheDocument());
    await user.click(screen.getByTestId('home-month-event'));
    await waitFor(() => expect(screen.getByTestId('home-calendar-peek-aggregation-empty')).toBeInTheDocument());
    expect(screen.getByTestId('home-calendar-peek-aggregation-empty')).toHaveTextContent('未提交');
  });

  it('preserves the real event id on the chip and uses peekAnchorId separately', async () => {
    server.use(http.get('/api/v2/plans/events', () => response([READY_EVENT])));
    renderWithClient();

    await waitFor(() => expect(screen.getByTestId('home-month-event')).toBeInTheDocument());
    const chip = screen.getByTestId('home-month-event');
    expect(chip).toHaveAttribute('data-event-id', READY_EVENT.id);
    expect(chip.getAttribute('data-peek-anchor')).toContain(READY_EVENT.id);
    expect(chip.getAttribute('data-peek-anchor')).not.toBe(READY_EVENT.id);
  });

  it('builds the week peek list in chronological order', async () => {
    const user = userEvent.setup();
    const monday = '2026-05-25';
    const tuesday = '2026-05-26';
    server.use(
      http.get(
        '/api/v2/plans/events',
        () =>
          response([
            { ...READY_EVENT, id: 'mon-noon', title: 'Monday noon', startAt: `${monday}T12:00:00+08:00`, endAt: `${monday}T13:00:00+08:00` },
            { ...READY_EVENT, id: 'mon-evening', title: 'Monday evening', startAt: `${monday}T18:00:00+08:00`, endAt: `${monday}T19:00:00+08:00` },
            { ...READY_EVENT, id: 'tue-morning', title: 'Tuesday morning', startAt: `${tuesday}T08:00:00+08:00`, endAt: `${tuesday}T09:00:00+08:00` },
            { ...READY_EVENT, id: 'tue-noon', title: 'Tuesday noon', startAt: `${tuesday}T12:00:00+08:00`, endAt: `${tuesday}T13:00:00+08:00` },
          ]),
      ),
    );
    renderWithClient();

    await waitFor(() => expect(screen.getAllByTestId('home-month-event')).toHaveLength(4));
    await user.click(screen.getByText('Monday noon'));
    await waitFor(() => expect(screen.getByTestId('home-calendar-peek-card')).toBeInTheDocument());
    await user.click(screen.getByTestId('home-calendar-peek-next'));
    expect(screen.getByRole('heading', { name: 'Monday evening' })).toBeInTheDocument();
  });

  it('renders Sunday-first DOW labels when startWeekOnMonday=false', async () => {
    server.use(http.get('/api/v2/plans/events', () => response([READY_EVENT])));
    renderWithClient(
      <WeekCalendarView viewConfig={createCalendarViewConfig({ view: 'week', startWeekOnMonday: false })} />,
    );

    await waitFor(() => expect(screen.getAllByRole('columnheader')).toHaveLength(7));
    const labels = screen
      .getAllByRole('columnheader')
      .map((element) => (element.querySelector('span:first-child')?.textContent ?? '').replace(' · 今日', ''));
    expect(labels).toEqual(['周日', '周一', '周二', '周三', '周四', '周五', '周六']);
  });

  it('renders EmptyState when API returns []', async () => {
    server.use(http.get('/api/v2/plans/events', () => response([])));
    renderWithClient();

    await waitFor(() => expect(screen.getByTestId('home-week-empty')).toBeInTheDocument());
  });

  it('renders ErrorCard on 500', async () => {
    server.use(http.get('/api/v2/plans/events', () => HttpResponse.json({}, { status: 500 })));
    renderWithClient();

    await waitFor(() => expect(screen.getByTestId('home-week-error')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('renders Skeleton stack while in flight', async () => {
    server.use(
      http.get('/api/v2/plans/events', async () => {
        await delay(50);
        return response([]);
      }),
    );
    renderWithClient();

    expect(screen.getByTestId('home-week-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('home-week-loading')).not.toBeInTheDocument());
  });
});
