/*
 * MonthGridDnd / MonthGrid ARIA structure tests — SIK-139 W4.
 *
 * Why: W1 review (Low) + W2 review (M-2) logged the grid/gridcell ARIA debt:
 *      role="grid" wrapped role="gridcell" with NO role="row" layer, which
 *      axe flags ("gridcell must be contained by row" / "grid children must
 *      be rows"). W4 repays it by inserting a role="row" per week
 *      (display:contents, zero layout shift) in BOTH the dnd grid and the
 *      static MonthGrid fallback. This suite proves the valid nesting
 *      (grid → row → gridcell) renders and that a real axe run sees no
 *      violations — the static jsx-a11y linter can't trace roles across the
 *      DroppableCell component boundary, so the runtime axe pass is the gate.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axe from 'axe-core';
import { usePlanStore } from '@sikao/domain';

import MonthGridDnd, { type MonthCellModel } from './MonthGridDnd';
import { CalendarPeekProvider, CalendarPeekCard } from '../peek';
import type { MonthDaySlice } from '../calendarEvents';
import type { CalendarCardProperty } from '../calendarViewConfig';

const PROPS: ReadonlyArray<CalendarCardProperty> = ['title', 'kind', 'status'];
const DOW = ['一', '二', '三', '四', '五', '六', '日'] as const;

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  rules: {
    'color-contrast': { enabled: false },
    'landmark-one-main': { enabled: false },
    region: { enabled: false },
  },
};

function makeEvent(id: string, title: string, day: string) {
  return {
    id, title,
    startAt: `${day}T09:00:00+08:00`, endAt: `${day}T10:00:00+08:00`,
    category: 'practice', status: 'planned', source: 'manual',
    timezone: 'Asia/Shanghai', notes: '', planId: 1, isRecurringInstance: false,
    deletedAt: null, linkedSessionId: null, parentId: null,
    recurringExceptionDates: [], recurringParentId: null, recurringRule: null, targetId: null,
  } as MonthDaySlice['event'];
}

function makeSlice(eventId: string, day: string): MonthDaySlice['slice'] {
  return {
    occurrenceRef: `${eventId}:${day}`, day,
    sliceStartAt: `${day}T09:00:00+08:00`, sliceEndAt: `${day}T10:00:00+08:00`,
    isStartSlice: true, isEndSlice: true,
  };
}

/** A full 42-cell month (6 weeks x 7) so the row chunking is exercised. */
function makeFullMonth(): MonthCellModel[] {
  return Array.from({ length: 42 }, (_, i) => ({
    stamp: `2026-05-${String(i + 1).padStart(2, '0')}`,
    dom: i + 1,
    inMonth: i < 31,
    isToday: false,
  }));
}

function renderGrid(items: ReadonlyArray<MonthDaySlice>) {
  const eventsByDay = new Map<string, MonthDaySlice[]>();
  for (const item of items) {
    const bucket = eventsByDay.get(item.slice.day);
    if (bucket) bucket.push(item);
    else eventsByDay.set(item.slice.day, [item]);
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CalendarPeekProvider>
        <MonthGridDnd
          cells={makeFullMonth()}
          eventsByDay={eventsByDay}
          dowLabels={DOW}
          cardLimitPerCell={3}
          visibleProperties={PROPS}
          window={{ from: '2026-04-30T16:00:00.000Z', to: '2026-05-31T15:59:59.999Z' }}
        />
        <CalendarPeekCard />
      </CalendarPeekProvider>
    </QueryClientProvider>,
  );
}

describe('MonthGridDnd grid ARIA (SIK-139 W4 debt closeout)', () => {
  afterEach(() => {
    usePlanStore.getState().resetOptimisticEvents();
  });

  it('nests grid → row → gridcell (6 week rows, 7 cells each)', () => {
    const item: MonthDaySlice = { slice: makeSlice('m1', '2026-05-15'), event: makeEvent('m1', '专项练习', '2026-05-15') };
    renderGrid([item]);
    const grid = screen.getByRole('grid');
    const rows = screen.getAllByRole('row');
    // 6 week rows + 1 day-of-week header row.
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(42);
    // every gridcell resolves its row ancestor inside the grid
    for (const cell of cells) {
      const row = cell.closest('[role="row"]');
      expect(row).not.toBeNull();
      expect(grid.contains(row)).toBe(true);
    }
  });

  it('has no axe violations for the rendered month grid (grid/row/gridcell + columnheader)', async () => {
    const item: MonthDaySlice = { slice: makeSlice('m1', '2026-05-15'), event: makeEvent('m1', '专项练习', '2026-05-15') };
    const { container } = renderGrid([item]);
    const results = await axe.run(container, AXE_OPTIONS);
    const summary = results.violations
      .map((v) => `[${v.id}] ${v.nodes.map((n) => n.html.slice(0, 80)).join(' | ')}`)
      .join('\n');
    expect(results.violations, summary).toEqual([]);
  });
});
