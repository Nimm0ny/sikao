/*
 * MonthGridDnd — SIK-139 W1.
 *
 * Why: plan §7 Wave 1 wires dnd-kit's DndContext + PointerSensor +
 *      KeyboardSensor onto the month grid so chips become drag handles and
 *      day cells become drop targets. This module owns the dnd RUNTIME and
 *      is lazy-loaded by MonthCalendarView (08-NonFunctional §1.2: dnd-kit
 *      MUST ship in a lazy chunk, off the Home first-paint path). The static
 *      MonthGrid renders as the Suspense fallback so LCP never waits on the
 *      dnd chunk.
 *
 *      AGENT-H7 / Wave 1 scope: drop is a NO-OP placeholder. onDragEnd only
 *      clears transient drag state — it does NOT compute a drop date, write
 *      the optimistic store, or fire a mutation. Reschedule math + optimistic
 *      patch + PATCH + rollback all land in Wave 2 (plan §7). No silent catch
 *      anywhere; the no-op is explicit, not a swallowed error path.
 *
 *      Draggable id = the per-slice peek anchor `${occurrenceRef}|${day}`
 *      (visual contract §2), so each cross-day slice of one event gets a
 *      distinct handle. The real mutation target stays on the chip's
 *      `data-event-id` (Wave 2 reads it). Droppable id = `cell.stamp`.
 */
import { useMemo, useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { usePlanStore } from '@sikao/domain';

import { MonthEventChip } from '../MonthEventChip';
import {
  useCalendarPeek,
  type CalendarPeekListEntry,
} from '../peek';
import type { MonthDaySlice } from '../calendarEvents';
import type { CalendarCardProperty } from '../calendarViewConfig';
import { useCalendarDragSensors } from './useCalendarDragSensors';
import styles from '../MonthCalendarView.module.css';

export interface MonthCellModel {
  readonly stamp: string;
  readonly dom: number;
  readonly inMonth: boolean;
  readonly isToday: boolean;
}

export interface MonthGridDndProps {
  readonly cells: ReadonlyArray<MonthCellModel>;
  readonly eventsByDay: ReadonlyMap<string, ReadonlyArray<MonthDaySlice>>;
  readonly dowLabels: ReadonlyArray<string>;
  readonly cardLimitPerCell: number;
  readonly visibleProperties: readonly CalendarCardProperty[];
}

/** Stable per-slice entry id — the draggable handle + peek anchor. */
function entryIdOf(slice: MonthDaySlice['slice']): string {
  return `${slice.occurrenceRef}|${slice.day}`;
}

/**
 * Draggable chip wrapper. Calls `useDraggable` (dnd runtime) and threads the
 * result into MonthEventChip's `drag` prop so the chip stays a plain,
 * statically-importable component. onClick (open Peek) is preserved — the
 * PointerSensor distance gate keeps a click from being eaten as a drag.
 */
function DraggableChip({
  item,
  entryId,
  visibleProperties,
  optimisticPatch,
  onOpen,
}: {
  readonly item: MonthDaySlice;
  readonly entryId: string;
  readonly visibleProperties: readonly CalendarCardProperty[];
  readonly optimisticPatch: Partial<MonthDaySlice['event']> | undefined;
  readonly onOpen: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: entryId,
    data: { eventId: item.event.id, day: item.slice.day },
  });
  return (
    <MonthEventChip
      event={item.event}
      slice={item.slice}
      visibleProperties={visibleProperties}
      peekAnchorId={entryId}
      optimisticPatch={optimisticPatch}
      onClick={onOpen}
      drag={{ setNodeRef, attributes, listeners, isDragging }}
    />
  );
}

/**
 * Droppable day cell. `useDroppable` keyed by `cell.stamp` marks the cell as
 * a drop target; `isOver` toggles the Wave 2 highlight hook (visual contract
 * §4). Wave 1 only exposes the attribute — no drop side effects yet.
 */
function DroppableCell({
  cell,
  children,
}: {
  readonly cell: MonthCellModel;
  readonly children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cell.stamp });
  return (
    <div
      ref={setNodeRef}
      className={styles.cell}
      data-out-of-month={!cell.inMonth || undefined}
      data-today={cell.isToday || undefined}
      data-drop-over={isOver || undefined}
      data-testid={`home-month-cell-${cell.stamp}`}
      role="gridcell"
    >
      {children}
    </div>
  );
}

function MonthGridDndInner({
  cells,
  eventsByDay,
  dowLabels,
  cardLimitPerCell,
  visibleProperties,
}: MonthGridDndProps) {
  const peek = useCalendarPeek();
  // SIK-139 W0 (D20): read-time optimistic patches keyed by real event id.
  // Subscribed reactively (not getState()) so an in-flight reschedule
  // preview re-renders — preserves the Wave 0 merge contract.
  const optimisticEvents = usePlanStore((s) => s.optimisticEvents);
  const sensors = useCalendarDragSensors();

  // SIK-139 W1: drag id of the chip currently being dragged, used only to
  // surface the active handle for the chip visual state via dnd's own
  // isDragging — kept in local state so onDragEnd can clear it explicitly.
  // This is transient UI state, NOT a reschedule target (Wave 2).
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);

  const peekList = useMemo<ReadonlyArray<CalendarPeekListEntry>>(() => {
    const out: CalendarPeekListEntry[] = [];
    for (const cell of cells) {
      const items = eventsByDay.get(cell.stamp) ?? [];
      const visible = items.slice(0, cardLimitPerCell);
      for (const item of visible) {
        out.push({ id: entryIdOf(item.slice), event: item.event });
      }
    }
    return out;
  }, [cells, eventsByDay, cardLimitPerCell]);

  // AGENT-H7 / Wave 1: drop is a NO-OP placeholder. onDragEnd ONLY clears the
  // transient active-drag id. No drop-date math, no upsertOptimisticEvent, no
  // useUpdateEvent — those land in Wave 2. The handlers are explicit so the
  // dnd lifecycle has no swallowed error path.
  function handleDragStart(event: DragStartEvent): void {
    setActiveDragId(event.active.id);
  }
  function handleDragEnd(): void {
    setActiveDragId(null);
  }
  function handleDragCancel(): void {
    setActiveDragId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={styles.dowRow} role="row">
        {dowLabels.map((label) => (
          <div key={label} className={styles.dowCell} role="columnheader">{label}</div>
        ))}
      </div>
      <div className={styles.bodyScroll}>
        <div className={styles.gridBody} role="grid" aria-label="本月日历" data-dnd-active={activeDragId != null || undefined}>
          {cells.map((cell) => {
            const items = eventsByDay.get(cell.stamp) ?? [];
            const visible = items.slice(0, cardLimitPerCell);
            const overflow = items.length - visible.length;
            return (
              <DroppableCell key={cell.stamp} cell={cell}>
                <span className={styles.dom}>{cell.dom}</span>
                <ul className={styles.eventList}>
                  {visible.map((item) => {
                    const entryId = entryIdOf(item.slice);
                    return (
                      <li key={entryId} className={styles.eventListItem}>
                        <DraggableChip
                          item={item}
                          entryId={entryId}
                          visibleProperties={visibleProperties}
                          optimisticPatch={optimisticEvents.get(item.event.id)}
                          onOpen={() => peek.open({ ...item.event, id: entryId }, peekList)}
                        />
                      </li>
                    );
                  })}
                  {overflow > 0 ? (
                    <li className={styles.moreLabel} data-testid="home-month-overflow">
                      +{overflow} 更多
                    </li>
                  ) : null}
                </ul>
              </DroppableCell>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}

/**
 * MonthGridDnd — the dnd-enabled month grid. Default export so
 * MonthCalendarView can `lazy(() => import('./dragDrop/MonthGridDnd'))` and
 * keep the dnd-kit runtime out of the Home first-paint chunk
 * (08-NonFunctional §1.2). The CalendarPeekProvider stays at the view root
 * (MonthCalendarView), so this component only consumes the peek context.
 */
export default function MonthGridDnd(props: MonthGridDndProps) {
  return <MonthGridDndInner {...props} />;
}
