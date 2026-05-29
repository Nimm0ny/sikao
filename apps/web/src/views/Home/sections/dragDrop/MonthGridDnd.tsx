// lint-allow-ui-copy
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

import type { EventConflictItemV2 } from '@sikao/api-client/types/home';
import type { MonthDaySlice } from '../calendarEvents';
import type { CalendarCardProperty } from '../calendarViewConfig';
import { MonthEventChip } from '../MonthEventChip';
import { useCalendarPeek, type CalendarPeekListEntry } from '../peek';
import styles from '../MonthCalendarView.module.css';
import { commitReschedule } from './commitReschedule';
import { type ConflictWindow } from './conflictGuard';
import { ConflictConfirmDialog } from './ConflictConfirmDialog';
import { gateRescheduleDrop } from './gateRescheduleDrop';
import { buildRescheduleAnnouncements } from './keyboardReschedule';
import {
  resolveCalendarDrop,
  type CalendarDropDecision,
  type DropDragData,
} from './resolveCalendarDrop';
import { useCalendarDragSensors } from './useCalendarDragSensors';
import { useRescheduleEvent } from './useRescheduleEvent';

const TZ = 'Asia/Shanghai';
const buildVisibleRowsMaxHeight = (visibleRows: number) =>
  `calc(${visibleRows} * var(--space-6) + ${Math.max(visibleRows - 1, 0)} * var(--space-1))`;

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
  readonly window: ConflictWindow;
}

function entryIdOf(slice: MonthDaySlice['slice']): string {
  return `${slice.occurrenceRef}|${slice.day}`;
}

function chunkIntoWeeks(
  cells: ReadonlyArray<MonthCellModel>,
): ReadonlyArray<ReadonlyArray<MonthCellModel>> {
  const weeks: MonthCellModel[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

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
  const optimisticEvents = usePlanStore((state) => state.optimisticEvents);
  const upsertOptimisticEvent = usePlanStore((state) => state.upsertOptimisticEvent);
  const removeOptimisticEvent = usePlanStore((state) => state.removeOptimisticEvent);
  const reschedule = useRescheduleEvent();
  const sensors = useCalendarDragSensors();

  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const announcements = useMemo(() => buildRescheduleAnnouncements(), []);
  const [pendingConflict, setPendingConflict] = useState<{
    readonly decision: Extract<CalendarDropDecision, { kind: 'reschedule' }>;
    readonly conflicts: readonly EventConflictItemV2[];
  } | null>(null);

  const peekList = useMemo<ReadonlyArray<CalendarPeekListEntry>>(() => {
    const out: CalendarPeekListEntry[] = [];
    for (const cell of cells) {
      const items = eventsByDay.get(cell.stamp) ?? [];
      for (const item of items) {
        out.push({ id: entryIdOf(item.slice), event: item.event });
      }
    }
    return out;
  }, [cells, eventsByDay]);

  function runCommit(decision: Extract<CalendarDropDecision, { kind: 'reschedule' }>): void {
    commitReschedule(decision, {
      upsertOptimisticEvent,
      removeOptimisticEvent,
      mutate: (variables, callbacks) => reschedule.mutate(variables, callbacks),
      notifyError: (title) => toast.error('改期失败', `《${title}》未能改期，请重试`),
    });
  }

  function handleDragStart(event: DragStartEvent): void {
    setActiveDragId(event.active.id);
    setKeyboardActive(event.activatorEvent instanceof KeyboardEvent);
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveDragId(null);
    setKeyboardActive(false);
    const data = (event.active.data.current ?? null) as DropDragData | null;
    const overId = event.over == null ? null : String(event.over.id);

    let decision: CalendarDropDecision;
    try {
      decision = resolveCalendarDrop(data, overId);
    } catch (err) {
      toast.error('改期失败', '事件时间数据异常，已取消改期');
      throw err instanceof Error ? err : new Error(String(err));
    }

    if (decision.kind !== 'reschedule' || data == null) {
      return;
    }

    void gateRescheduleDrop(
      decision,
      data,
      { window, timeZone: TZ },
      {
        onCommit: (nextDecision) => runCommit(nextDecision),
        onConflict: (nextDecision, conflicts) => setPendingConflict({ decision: nextDecision, conflicts }),
        onError: () => toast.error('改期失败', '落点冲突校验未完成，请重试'),
      },
    );
  }

  function handleDragCancel(): void {
    setActiveDragId(null);
    setKeyboardActive(false);
  }

  function handleConflictConfirm(): void {
    if (pendingConflict == null) return;
    const { decision } = pendingConflict;
    setPendingConflict(null);
    runCommit(decision);
  }

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
        <div
          className={styles.gridRoot}
          role="grid"
          aria-label="本月日历"
          data-dnd-active={activeDragId != null || undefined}
        >
          <div className={styles.dowRow} role="row">
            {dowLabels.map((label) => (
              <div key={label} className={styles.dowCell} role="columnheader">
                {label}
              </div>
            ))}
          </div>
          <div className={styles.bodyScroll}>
            <div className={styles.gridBody} role="rowgroup">
              {chunkIntoWeeks(cells).map((week) => (
                <div key={week[0]?.stamp ?? 'week'} className={styles.gridRow} role="row">
                  {week.map((cell) => {
                    const items = eventsByDay.get(cell.stamp) ?? [];
                    return (
                      <DroppableCell key={cell.stamp} cell={cell} keyboardActive={keyboardActive}>
                        <span className={styles.dom}>{cell.dom}</span>
                        <ul
                          className={styles.eventList}
                          data-testid={`home-month-event-list-${cell.stamp}`}
                          data-scrollable={items.length > cardLimitPerCell || undefined}
                          style={{ maxHeight: buildVisibleRowsMaxHeight(cardLimitPerCell) }}
                        >
                          {items.map((item) => {
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

export default function MonthGridDnd(props: MonthGridDndProps) {
  return <MonthGridDndInner {...props} />;
}
