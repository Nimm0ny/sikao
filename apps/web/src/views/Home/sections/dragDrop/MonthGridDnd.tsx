// lint-allow-ui-copy
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
 *      AGENT-H7 / Wave 2: drop now reschedules. onDragEnd resolves the drop
 *      target day, computes the shifted times via the pure `rescheduleEvent`,
 *      writes an optimistic patch, and PATCHes the event; success drops the
 *      placeholder (refetch becomes truth) and failure rolls it back with an
 *      explicit error toast. No silent catch: drop-outside / same-day are
 *      explicit no-ops, malformed input throws after a toast, mutation
 *      rejection rolls back. Conflict pre-check (Requirement 7) + full
 *      keyboard reschedule (Requirement 5) remain Wave 3 / Wave 4.
 *
 *      Draggable id = the per-slice peek anchor `${occurrenceRef}|${day}`
 *      (visual contract §2), so each cross-day slice of one event gets a
 *      distinct handle. The real mutation target stays on the chip's
 *      `data-event-id` (Wave 2 reads it). Droppable id = `cell.stamp`.
 */
// lint-allow-ui-copy: drag-drop failure toasts remain localized inline in
// this file until the broader W3/W4 drag surface cleanup lands.
import { useMemo, useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { toast } from '@sikao/shared-utils';
import { usePlanStore } from '@sikao/domain';

import { MonthEventChip } from '../MonthEventChip';
import {
  useCalendarPeek,
  type CalendarPeekListEntry,
} from '../peek';
import type { MonthDaySlice } from '../calendarEvents';
import type { CalendarCardProperty } from '../calendarViewConfig';
import { useCalendarDragSensors } from './useCalendarDragSensors';
import {
  resolveCalendarDrop,
  type CalendarDropDecision,
  type DropDragData,
} from './resolveCalendarDrop';
import { commitReschedule } from './commitReschedule';
import { useRescheduleEvent } from './useRescheduleEvent';
import { type ConflictWindow } from './conflictGuard';
import { gateRescheduleDrop } from './gateRescheduleDrop';
import { buildRescheduleAnnouncements } from './keyboardReschedule';
import { ConflictConfirmDialog } from './ConflictConfirmDialog';
import type { EventConflictItemV2 } from '@sikao/api-client/types/home';
import styles from '../MonthCalendarView.module.css';

/** Calendar render zone — drives the conflict window date mapping (H6). */
const TZ = 'Asia/Shanghai';

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
  // SIK-139 W3: the month view window (ISO datetimes from buildViewRange),
  // forwarded so the conflict pre-check can scope `detectEventConflicts` to
  // what the grid actually shows.
  readonly window: ConflictWindow;
}

/** Stable per-slice entry id — the draggable handle + peek anchor. */
function entryIdOf(slice: MonthDaySlice['slice']): string {
  return `${slice.occurrenceRef}|${slice.day}`;
}

/**
 * Chunk the flat 42-cell month grid into weeks of 7 so each week can be
 * wrapped in a `role="row"` (SIK-139 W4 grid ARIA fix: grid → row → gridcell
 * is the valid nesting). The row wrapper uses `display: contents` so the
 * cells still flow into the parent CSS grid unchanged — ARIA tree gains the
 * row, layout geometry does not shift.
 */
function chunkIntoWeeks(
  cells: ReadonlyArray<MonthCellModel>,
): ReadonlyArray<ReadonlyArray<MonthCellModel>> {
  const weeks: MonthCellModel[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
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
    data: {
      eventId: item.event.id,
      fromDay: item.slice.day,
      startAt: item.event.startAt,
      endAt: item.event.endAt,
      title: item.event.title,
      // SIK-139 W3: descriptive fields the conflict pre-check builds the
      // proposed event from (alongside the shifted times). Carried on the
      // drag data so the gate stays off the chip's render path.
      category: item.event.category,
      timezone: item.event.timezone,
      recurringRule: item.event.recurringRule,
    },
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
 * a drop target; `isOver` toggles the Wave 2 drag-hover highlight (visual
 * contract §4). SIK-139 W4: when the active drag is keyboard-driven, the
 * over cell also gets `data-keyboard-over` for the distinct solid focus-ring
 * preview outline (contract §4 keyboard-move preview).
 */
function DroppableCell({
  cell,
  keyboardActive,
  children,
}: {
  readonly cell: MonthCellModel;
  readonly keyboardActive: boolean;
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
      data-keyboard-over={(isOver && keyboardActive) || undefined}
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
  window,
}: MonthGridDndProps) {
  const peek = useCalendarPeek();
  // SIK-139 W0 (D20): read-time optimistic patches keyed by real event id.
  // Subscribed reactively (not getState()) so an in-flight reschedule
  // preview re-renders — preserves the Wave 0 merge contract.
  const optimisticEvents = usePlanStore((s) => s.optimisticEvents);
  // SIK-139 W2: optimistic write + rollback setters. The grid owns the store
  // write (the reschedule hook stays a thin network wrapper); chips remain
  // read-only consumers of optimisticEvents.
  const upsertOptimisticEvent = usePlanStore((s) => s.upsertOptimisticEvent);
  const removeOptimisticEvent = usePlanStore((s) => s.removeOptimisticEvent);
  const reschedule = useRescheduleEvent();
  const sensors = useCalendarDragSensors();

  // SIK-139 W1: drag id of the chip currently being dragged, used only to
  // surface the active handle for the chip visual state via dnd's own
  // isDragging — kept in local state so onDragEnd can clear it explicitly.
  // This is transient UI state, NOT a reschedule target (Wave 2).
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);

  // SIK-139 W4: whether the active drag was started by the keyboard (Space/
  // Enter via KeyboardSensor) rather than the pointer. Drives the distinct
  // keyboard-move preview outline (data-keyboard-over) on the over cell so
  // the keyboard landing target is visually unmistakable (contract §4).
  const [keyboardActive, setKeyboardActive] = useState(false);

  // SIK-139 W4: aria-live announcements for the keyboard reschedule. Built
  // once (reads the dragged title off active.data per drag) and fed to
  // DndContext so the live region narrates the candidate date in Chinese
  // instead of dnd-kit's default English over-id (Requirement 5).
  const announcements = useMemo(() => buildRescheduleAnnouncements(), []);

  // SIK-139 W3: the conflict confirm dialog state. When the pre-check finds
  // conflicts the reschedule is HELD here (decision + conflict list) until the
  // user confirms (commit) or cancels (drop it — no store write, no PATCH).
  const [pendingConflict, setPendingConflict] = useState<{
    readonly decision: Extract<CalendarDropDecision, { kind: 'reschedule' }>;
    readonly conflicts: readonly EventConflictItemV2[];
  } | null>(null);

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

  // SIK-139 W2 commit: optimistic write → PATCH → success-clear / reject
  // rollback + toast. Extracted (W2 review M-1) so it is unit-tested without a
  // real dnd drop. W3 reuses it verbatim from BOTH the conflict-clear path and
  // the post-confirm path — the W2 contract is unchanged.
  function runCommit(decision: Extract<CalendarDropDecision, { kind: 'reschedule' }>): void {
    commitReschedule(decision, {
      upsertOptimisticEvent,
      removeOptimisticEvent,
      mutate: (variables, callbacks) => reschedule.mutate(variables, callbacks),
      notifyError: (title) => toast.error('改期失败', `「${title}」未能改期，请重试`),
    });
  }

  function handleDragStart(event: DragStartEvent): void {
    setActiveDragId(event.active.id);
    // W4: a KeyboardSensor activation carries a KeyboardEvent as the
    // activatorEvent; pointer drags carry a PointerEvent. This flags the
    // keyboard-move preview outline without a parallel "mode" store.
    setKeyboardActive(event.activatorEvent instanceof KeyboardEvent);
  }

  // SIK-139 W3: drop → conflict gate → reschedule. After the W2 decision
  // resolves a reschedule, a landing-conflict pre-check runs BEFORE any commit
  // (design "W3 Conflict Check Design"). The three outcomes are kept strictly
  // apart (AGENT-H7 / design Decisions 1):
  //   - no conflicts        → commit straight away (W2 path unchanged)
  //   - conflicts found     → hold the decision + open the confirm dialog
  //   - detect request FAILS → toast + DO NOT commit (never "no conflict")
  // Non-reschedule decisions (cancel / noop) and malformed-time throws keep
  // their W2 behavior.
  function handleDragEnd(event: DragEndEvent): void {
    setActiveDragId(null);
    setKeyboardActive(false);
    const data = (event.active.data.current ?? null) as DropDragData | null;
    const overId = event.over == null ? null : String(event.over.id);

    let decision: CalendarDropDecision;
    try {
      decision = resolveCalendarDrop(data, overId);
    } catch (err) {
      // rescheduleEvent threw on malformed times — surface, do not guess.
      toast.error('改期失败', '事件时间数据异常，已取消改期');
      throw err instanceof Error ? err : new Error(String(err));
    }

    if (decision.kind !== 'reschedule' || data == null) {
      return; // 'cancel' (outside / no data) or 'noop' (same day)
    }

    // W4 (F-3): the decision→gate→branch wiring lives in the tested
    // `gateRescheduleDrop` seam (NOT a second commit path — it binds the same
    // buildProposedEvent + runConflictGate the W3 component used). H7: clear →
    // commit, conflict → hold + dialog, detect failure → toast, no commit.
    void gateRescheduleDrop(
      decision,
      data,
      { window, timeZone: TZ },
      {
        onCommit: (d) => runCommit(d),
        onConflict: (d, conflicts) => setPendingConflict({ decision: d, conflicts }),
        onError: () => toast.error('改期失败', '落点冲突校验未完成，请重试'),
      },
    );
  }

  function handleDragCancel(): void {
    setActiveDragId(null);
    setKeyboardActive(false);
  }

  // Dialog confirm: user accepts the conflict → run the held commit (W2 path).
  function handleConflictConfirm(): void {
    if (pendingConflict == null) return;
    const { decision } = pendingConflict;
    setPendingConflict(null);
    runCommit(decision);
  }

  // Dialog cancel / Esc / scrim: drop the held decision — no store write, no
  // PATCH (AGENT-H7 clean exit).
  function handleConflictCancel(): void {
    setPendingConflict(null);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* W4 grid ARIA fix: ONE role="grid" wraps the day-of-week header row
            and the body rowgroup so every row (header + weeks) has a valid
            grid ancestor (grid → row → columnheader / grid → rowgroup → row →
            gridcell). The wrapper is display:contents so the existing
            sticky-head + scroll-body flex layout is unchanged. */}
        <div className={styles.gridRoot} role="grid" aria-label="本月日历" data-dnd-active={activeDragId != null || undefined}>
          <div className={styles.dowRow} role="row">
            {dowLabels.map((label) => (
              <div key={label} className={styles.dowCell} role="columnheader">{label}</div>
            ))}
          </div>
          <div className={styles.bodyScroll}>
            <div className={styles.gridBody} role="rowgroup">
              {chunkIntoWeeks(cells).map((week) => (
                // Each week is a role="row" between the rowgroup and the
                // gridcells. display:contents keeps the cells in the parent
                // CSS grid (no layout shift) while the ARIA tree gains the row.
                <div key={week[0]?.stamp ?? 'week'} className={styles.gridRow} role="row">
                  {week.map((cell) => {
                    const items = eventsByDay.get(cell.stamp) ?? [];
                    const visible = items.slice(0, cardLimitPerCell);
                    const overflow = items.length - visible.length;
                    return (
                      <DroppableCell key={cell.stamp} cell={cell} keyboardActive={keyboardActive}>
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
              ))}
            </div>
          </div>
        </div>
      </DndContext>
      <ConflictConfirmDialog
        open={pendingConflict != null}
        conflicts={pendingConflict?.conflicts ?? []}
        onConfirm={handleConflictConfirm}
        onCancel={handleConflictCancel}
      />
    </>
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
