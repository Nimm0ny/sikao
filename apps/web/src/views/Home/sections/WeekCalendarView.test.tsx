import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';

import { server } from '../../../mocks/server';
import { WeekCalendarView } from './WeekCalendarView';
import { createCalendarViewConfig } from './calendarViewConfig';

function renderWithClient(
  ui: ReactNode = <WeekCalendarView />,
) {
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
      <WeekCalendarView
        viewConfig={createCalendarViewConfig({ view: 'week', cardLimitPerCell: 2 })}
      />,
    );
    await waitFor(() => expect(screen.getAllByTestId('home-week-event')).toHaveLength(4));
    expect(screen.getByTestId(`home-week-event-list-${today}-0`)).toHaveStyle({
      maxHeight: 'calc(2 * var(--space-6) + 1 * var(--space-1))',
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

  it('renders Sunday-first DOW labels when startWeekOnMonday=false', async () => {
    server.use(http.get('/api/v2/plans/events', () => response([READY_EVENT])));
    renderWithClient(
      <WeekCalendarView
        viewConfig={createCalendarViewConfig({ view: 'week', startWeekOnMonday: false })}
      />,
    );
    await waitFor(() => expect(screen.getAllByRole('columnheader')).toHaveLength(7));
    const labels = screen
      .getAllByRole('columnheader')
      .map((el) => (el.querySelector('span:first-child')?.textContent ?? '').replace(' · 今日', ''));
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
