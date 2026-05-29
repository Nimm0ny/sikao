// lint-allow-ui-copy: V5 SIK-126 Month calendar copy. CJK strings are
// visual contract from `.tmp_review/out/Tab1-Home/Home v2.1.html`.
import { lazy, Suspense, useMemo } from 'react';
import { useEvents } from '@sikao/api-client/plansQueries';
import { buildViewRange } from '@sikao/calendar-engine';
import { usePlanStore } from '@sikao/domain';

import { EmptyState } from '../../../components/atom/EmptyState';
import { Skeleton } from '../../../components/atom/Skeleton';
import {
  expandPlanEventsForView,
  sliceMonthOccurrencesByDay,
  type MonthDaySlice,
} from './calendarEvents';
import {
  createDefaultCalendarViewConfig,
  type CalendarCardProperty,
  type CalendarViewConfig,
} from './calendarViewConfig';
import { MonthEventChip } from './MonthEventChip';
import {
  CalendarPeekCard,
  CalendarPeekProvider,
  useCalendarPeek,
  type CalendarPeekListEntry,
} from './peek';
import styles from './MonthCalendarView.module.css';

const MonthGridDnd = lazy(() => import('./dragDrop/MonthGridDnd'));

const TZ = 'Asia/Shanghai';
const DOW_LABELS_MON_FIRST = ['一', '二', '三', '四', '五', '六', '日'] as const;
const DOW_LABELS_SUN_FIRST = ['日', '一', '二', '三', '四', '五', '六'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const todayStamp = () => localStamp(new Date());
const buildVisibleRowsMaxHeight = (visibleRows: number) =>
  `calc(${visibleRows} * var(--space-6) + ${Math.max(visibleRows - 1, 0)} * var(--space-1))`;

interface MonthCell {
  readonly stamp: string;
  readonly dom: number;
  readonly inMonth: boolean;
  readonly isToday: boolean;
}

function buildMonthCells(anchorDate: string, startWeekOnMonday: boolean): MonthCell[] {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const month = anchor.getMonth();
  const offset = startWeekOnMonday ? (anchor.getDay() + 6) % 7 : anchor.getDay();
  const gridStart = new Date(anchor);
  gridStart.setDate(anchor.getDate() - offset);
  const today = todayStamp();
  return Array.from({ length: 21 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    const stamp = localStamp(day);
    return {
      stamp,
      dom: day.getDate(),
      inMonth: day.getMonth() === month,
      isToday: stamp === today,
    };
  });
}

function bucketEventsByDay(
  enriched: ReadonlyArray<MonthDaySlice>,
): Map<string, MonthDaySlice[]> {
  const map = new Map<string, MonthDaySlice[]>();
  for (const item of enriched) {
    const bucket = map.get(item.slice.day);
    if (bucket) bucket.push(item);
    else map.set(item.slice.day, [item]);
  }
  return map;
}

function chunkIntoWeeks(cells: ReadonlyArray<MonthCell>): ReadonlyArray<ReadonlyArray<MonthCell>> {
  const weeks: MonthCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

function MonthGrid({
  cells,
  eventsByDay,
  dowLabels,
  cardLimitPerCell,
  visibleProperties,
}: {
  readonly cells: ReadonlyArray<MonthCell>;
  readonly eventsByDay: ReadonlyMap<string, ReadonlyArray<MonthDaySlice>>;
  readonly dowLabels: ReadonlyArray<string>;
  readonly cardLimitPerCell: number;
  readonly visibleProperties: readonly CalendarCardProperty[];
}) {
  const peek = useCalendarPeek();
  const optimisticEvents = usePlanStore((state) => state.optimisticEvents);

  const peekList = useMemo<ReadonlyArray<CalendarPeekListEntry>>(() => {
    const out: CalendarPeekListEntry[] = [];
    for (const cell of cells) {
      const items = eventsByDay.get(cell.stamp) ?? [];
      for (const item of items) {
        out.push({
          id: `${item.slice.occurrenceRef}|${item.slice.day}`,
          event: item.event,
        });
      }
    }
    return out;
  }, [cells, eventsByDay]);

  return (
    <div className={styles.gridRoot} role="grid" aria-label="本月日历">
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
                  <div
                    key={cell.stamp}
                    className={styles.cell}
                    data-out-of-month={!cell.inMonth || undefined}
                    data-today={cell.isToday || undefined}
                    data-testid={`home-month-cell-${cell.stamp}`}
                    role="gridcell"
                  >
                    <span className={styles.dom}>{cell.dom}</span>
                    <ul
                      className={styles.eventList}
                      data-testid={`home-month-event-list-${cell.stamp}`}
                      data-scrollable={items.length > cardLimitPerCell || undefined}
                      style={{ maxHeight: buildVisibleRowsMaxHeight(cardLimitPerCell) }}
                    >
                      {items.map((item) => {
                        const entryId = `${item.slice.occurrenceRef}|${item.slice.day}`;
                        return (
                          <li key={entryId} className={styles.eventListItem}>
                            <MonthEventChip
                              event={item.event}
                              slice={item.slice}
                              visibleProperties={visibleProperties}
                              peekAnchorId={entryId}
                              optimisticPatch={optimisticEvents.get(item.event.id)}
                              onClick={() => peek.open({ ...item.event, id: entryId }, peekList)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface MonthCalendarViewProps {
  readonly viewConfig?: CalendarViewConfig;
}

export function MonthCalendarView(props: MonthCalendarViewProps = {}) {
  return (
    <CalendarPeekProvider>
      <MonthCalendarViewBody {...props} />
      <CalendarPeekCard />
    </CalendarPeekProvider>
  );
}

function MonthCalendarViewBody({ viewConfig }: MonthCalendarViewProps) {
  const anchorDate = usePlanStore((state) => state.currentDate);
  const config = viewConfig ?? createDefaultCalendarViewConfig('month');
  const window = useMemo(
    () =>
      buildViewRange('month', {
        anchorDate,
        timeZone: TZ,
        startWeekOnMonday: config.startWeekOnMonday,
      }),
    [anchorDate, config.startWeekOnMonday],
  );
  const query = useEvents({
    from: window.from,
    to: window.to,
    tz: TZ,
    includePracticeBlocks: false,
  });
  const cells = useMemo(
    () => buildMonthCells(anchorDate, config.startWeekOnMonday),
    [anchorDate, config.startWeekOnMonday],
  );
  const dowLabels = config.startWeekOnMonday ? DOW_LABELS_MON_FIRST : DOW_LABELS_SUN_FIRST;
  const slices = useMemo(() => {
    const events = query.data?.data.events ?? [];
    return sliceMonthOccurrencesByDay(expandPlanEventsForView(events, window));
  }, [query.data, window]);
  const eventsByDay = useMemo(() => bucketEventsByDay(slices), [slices]);
  const total = query.data?.data.events.length ?? 0;

  return (
    <div className={styles.root} data-testid="home-month-calendar">
      {query.isLoading ? (
        <div
          className={styles.stateWrap}
          role="status"
          aria-label="本月日历加载中"
          data-testid="home-month-loading"
        >
          <Skeleton variant="rect" height={32} />
          <Skeleton variant="rect" height={96} />
        </div>
      ) : null}
      {query.isError ? (
        <div className={styles.stateWrap} role="alert" data-testid="home-month-error">
          <div className={styles.errorCard}>
            <span className={styles.errorCardTitle}>无法加载本月日历</span>
            <span>{String((query.error as Error | null)?.message ?? 'Network error')}</span>
            <button
              type="button"
              className={styles.retry}
              onClick={() => {
                void query.refetch();
              }}
            >
              重试
            </button>
          </div>
        </div>
      ) : null}
      {query.isSuccess && total === 0 ? (
        <div className={styles.stateWrap} data-testid="home-month-empty">
          <EmptyState
            title="本月尚无事件"
            description="可在“开始今日练习” CTA 中创建一次专项练习。"
          />
        </div>
      ) : null}
      {query.isSuccess && total > 0 ? (
        <Suspense
          fallback={
            <MonthGrid
              cells={cells}
              eventsByDay={eventsByDay}
              dowLabels={dowLabels}
              cardLimitPerCell={config.cardLimitPerCell}
              visibleProperties={config.visibleProperties}
            />
          }
        >
          <MonthGridDnd
            cells={cells}
            eventsByDay={eventsByDay}
            dowLabels={dowLabels}
            cardLimitPerCell={config.cardLimitPerCell}
            visibleProperties={config.visibleProperties}
            window={window}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
