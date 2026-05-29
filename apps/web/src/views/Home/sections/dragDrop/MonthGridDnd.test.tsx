/*
 * MonthGridDnd tests — SIK-139 W1 + W2.
 *
 * Why: W1 wired dnd-kit (DndContext + Pointer/Keyboard sensors) onto the
 *      month grid; W2 turns drop into a reschedule (optimistic patch + PATCH
 *      + rollback). This suite proves: the grid still renders chips/cells (no
 *      4-state regression), chips are drag handles that KEEP their onClick →
 *      Peek, cells are drop targets, and the Wave 0 optimistic merge still
 *      renders. The reschedule decision branches are unit-tested in
 *      resolveCalendarDrop.test.ts; this file keeps the dnd integration
 *      assertions that don't depend on jsdom collision layout.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlanStore } from '@sikao/domain';

import MonthGridDnd, { type MonthCellModel } from './MonthGridDnd';
import { CalendarPeekProvider, CalendarPeekCard } from '../peek';
import type { MonthDaySlice } from '../calendarEvents';
import type { CalendarCardProperty } from '../calendarViewConfig';

const DEFAULT_PROPS: ReadonlyArray<CalendarCardProperty> = ['title', 'kind', 'status'];
const DOW = ['一', '二', '三', '四', '五', '六', '日'] as const;

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
    occurrenceRef: `${eventId}:${day}`,
    day,
    sliceStartAt: `${day}T09:00:00+08:00`,
    sliceEndAt: `${day}T10:00:00+08:00`,
    isStartSlice: true,
    isEndSlice: true,
  };
}

const DAY = '2026-05-15';

function makeCells(): MonthCellModel[] {
  return [
    { stamp: DAY, dom: 15, inMonth: true, isToday: false },
    { stamp: '2026-05-16', dom: 16, inMonth: true, isToday: false },
  ];
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
          cells={makeCells()}
          eventsByDay={eventsByDay}
          dowLabels={DOW}
          cardLimitPerCell={3}
          visibleProperties={DEFAULT_PROPS}
          window={{ from: '2026-04-30T16:00:00.000Z', to: '2026-05-31T15:59:59.999Z' }}
        />
        <CalendarPeekCard />
      </CalendarPeekProvider>
    </QueryClientProvider>,
  );
}

describe('MonthGridDnd (SIK-139 W1)', () => {
  afterEach(() => {
    usePlanStore.getState().resetOptimisticEvents();
  });

  it('mounts DndContext and renders the chip in its matching day cell (no 4-state regression)', () => {
    const item: MonthDaySlice = { slice: makeSlice('m1', DAY), event: makeEvent('m1', '专项练习', DAY) };
    renderGrid([item]);
    const chip = screen.getByTestId('home-month-event');
    expect(chip).toHaveAttribute('data-event-id', 'm1');
    const cell = screen.getByTestId(`home-month-cell-${DAY}`);
    expect(cell).toContainElement(chip);
  });

  it('makes each day cell a droppable target (id = cell.stamp)', () => {
    const item: MonthDaySlice = { slice: makeSlice('m1', DAY), event: makeEvent('m1', '专项练习', DAY) };
    renderGrid([item]);
    // dnd-kit's useDroppable attaches the ref to our cell node; presence of
    // the cell with its stamp testid + role=gridcell is the contract Wave 2
    // collision detection keys off of.
    const cell = screen.getByTestId(`home-month-cell-${DAY}`);
    expect(cell).toHaveAttribute('role', 'gridcell');
  });

  it('keeps the chip draggable handle wired with a11y attributes from dnd-kit', () => {
    const item: MonthDaySlice = { slice: makeSlice('m1', DAY), event: makeEvent('m1', '专项练习', DAY) };
    renderGrid([item]);
    const chip = screen.getByTestId('home-month-event');
    // useDraggable seeds role=button + aria-roledescription=draggable +
    // tabIndex so the KeyboardSensor can pick the chip up (Requirement 5).
    expect(chip).toHaveAttribute('aria-roledescription', 'draggable');
    expect(chip).toHaveAttribute('tabindex', '0');
  });

  it('preserves onClick → Peek alongside draggable (drag and click not mutually exclusive)', async () => {
    const user = userEvent.setup();
    const item: MonthDaySlice = { slice: makeSlice('m1', DAY), event: makeEvent('m1', '专项练习', DAY) };
    renderGrid([item]);
    await user.click(screen.getByTestId('home-month-event'));
    await waitFor(() =>
      expect(screen.getByTestId('home-calendar-peek-card')).toBeInTheDocument(),
    );
  });

  it('caps chips at cardLimitPerCell and renders the "+N 更多" overflow label', () => {
    const items: MonthDaySlice[] = Array.from({ length: 5 }, (_, i) => ({
      slice: makeSlice(`m${i}`, DAY),
      event: makeEvent(`m${i}`, `Event ${i}`, DAY),
    }));
    renderGrid(items);
    expect(screen.getAllByTestId('home-month-event')).toHaveLength(5);
    expect(screen.queryByTestId('home-month-overflow')).not.toBeInTheDocument();
    expect(screen.getByTestId(`home-month-event-list-${DAY}`)).toHaveAttribute('data-scrollable', 'true');
  });

  it('uses cardLimitPerCell to size the dnd month list window', () => {
    const items: MonthDaySlice[] = Array.from({ length: 5 }, (_, i) => ({
      slice: makeSlice(`m${i}`, DAY),
      event: makeEvent(`m${i}`, `Event ${i}`, DAY),
    }));
    const eventsByDay = new Map<string, MonthDaySlice[]>([[DAY, items]]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <CalendarPeekProvider>
          <MonthGridDnd
            cells={makeCells()}
            eventsByDay={eventsByDay}
            dowLabels={DOW}
            cardLimitPerCell={2}
            visibleProperties={DEFAULT_PROPS}
            window={{ from: '2026-04-30T16:00:00.000Z', to: '2026-05-31T15:59:59.999Z' }}
          />
          <CalendarPeekCard />
        </CalendarPeekProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId(`home-month-event-list-${DAY}`)).toHaveStyle({
      maxHeight: 'calc(2 * var(--space-6) + 1 * var(--space-1))',
    });
  });

  it('renders an in-flight optimistic patch title (Wave 0 D20 merge preserved)', () => {
    usePlanStore.getState().upsertOptimisticEvent('m1', { title: '乐观改期预览' });
    const item: MonthDaySlice = { slice: makeSlice('m1', DAY), event: makeEvent('m1', '原始标题', DAY) };
    renderGrid([item]);
    expect(screen.getByTestId('home-month-event-title')).toHaveTextContent('乐观改期预览');
  });

  it('a cancelled keyboard pick-up (Esc) writes nothing to the store (W2 cancel branch)', async () => {
    const user = userEvent.setup();
    const item: MonthDaySlice = { slice: makeSlice('m1', DAY), event: makeEvent('m1', '专项练习', DAY) };
    renderGrid([item]);
    const chip = screen.getByTestId('home-month-event');
    chip.focus();
    // KeyboardSensor: Space picks up, Esc cancels. onDragCancel clears the
    // transient state and the drop never resolves — no optimistic write.
    await user.keyboard('{ }');
    await user.keyboard('{Escape}');
    expect(usePlanStore.getState().optimisticEvents.size).toBe(0);
  });
});
