// lint-allow-ui-copy: V5 SIK-126 Month calendar copy. CJK strings are
// visual contract from `.tmp_review/out/Tab1-Home/Home v2.1.html`.
import { lazy, Suspense, useMemo } from 'react';
import { useEvents } from '@sikao/api-client/plansQueries';
import { buildViewRange } from '@sikao/calendar-engine';
import { usePlanStore } from '@sikao/domain';
import { Skeleton } from '../../../components/atom/Skeleton';
import { EmptyState } from '../../../components/atom/EmptyState';
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

// SIK-139 W1: the dnd-kit runtime ships in a lazy chunk (08-NonFunctional
// §1.2 — dnd-kit MUST be lazy-loaded, off the Home first-paint path). The
// static MonthGrid below renders as the Suspense fallback so LCP never
// waits on the dnd chunk; the dnd-enabled grid swaps in once loaded.
const MonthGridDnd = lazy(() => import('./dragDrop/MonthGridDnd'));

/*
 * MonthCalendarView — V5 SIK-126 (Home v2.1 month view).
 *
 * Why: 7-col x 5-6 row month grid. The day-of-week head sits in its own
 *      DOM node (sticky); the body lives in a separate overflow-y
 *      scroller showing 3 rows worth of viewport. Each cell renders a
 *      dom number (today=black filled circle), event chips up to
 *      MAX_CHIPS_PER_CELL, and a "+N more" overflow label. Out-of-month
 *      cells dim per the prototype.
 *
 *      AGENT-H7: 4-state contract identical to Today / Week.
 *
 *      SIK-138 W4: `cardLimitPerCell` and `startWeekOnMonday` come from
 *      the injected CalendarViewConfig. Default config keeps `3` and
 *      Monday-first per Requirements 4 and 5.
 *
 *      SIK-138 W4.5 (D16 / D17): events are routed through
 *      `expandPlanEventsForView` (recurring expansion) and then through
 *      `sliceMonthOccurrencesByDay` so cross-day events render on every
 *      day they touch and recurring rules emit one chip per occurrence
 *      inside the visible window.
 */

const TZ = 'Asia/Shanghai';
const DOW_LABELS_MON_FIRST = ['一', '二', '三', '四', '五', '六', '日'] as const;
const DOW_LABELS_SUN_FIRST = ['日', '一', '二', '三', '四', '五', '六'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (v: Date) => `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
const todayStamp = () => localStamp(new Date());

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
  return Array.from({ length: 21 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const stamp = localStamp(d);
    return {
      stamp, dom: d.getDate(), inMonth: d.getMonth() === month,
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

/**
 * Chunk the flat rolling window into weeks of 7 so the static fallback wraps
 * each week in a `role="row"` — identical grid → row → gridcell nesting as
 * the dnd grid (SIK-139 W4). Both paths must match or the Suspense swap
 * would shift the ARIA structure. display:contents on the row keeps the CSS
 * grid layout unchanged.
 */
function chunkIntoWeeks(cells: ReadonlyArray<MonthCell>): ReadonlyArray<ReadonlyArray<MonthCell>> {
  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function MonthGrid({ cells, eventsByDay, dowLabels, cardLimitPerCell, visibleProperties }: {
  readonly cells: ReadonlyArray<MonthCell>;
  readonly eventsByDay: ReadonlyMap<string, ReadonlyArray<MonthDaySlice>>;
  readonly dowLabels: ReadonlyArray<string>;
  readonly cardLimitPerCell: number;
  readonly visibleProperties: readonly CalendarCardProperty[];
}) {
  const peek = useCalendarPeek();
  // SIK-139 W0 (D20): read-time optimistic patches keyed by real event id.
  // The grid reads the map once and hands each chip its own patch so an
  // in-flight reschedule (Phase 3) previews before the refetch lands. The
  // grid never writes the store.
  const optimisticEvents = usePlanStore((s) => s.optimisticEvents);

  // Peek list scope: chronological list of every chip currently rendered
  // in the visible month grid. prev / next walk this scope; entries are
  // keyed by `${occurrenceRef}|${day}` so cross-day slices each get their
  // own entry but resolve to the same source event.
  const peekList = useMemo<ReadonlyArray<CalendarPeekListEntry>>(() => {
    const out: CalendarPeekListEntry[] = [];
    for (const cell of cells) {
      const items = eventsByDay.get(cell.stamp) ?? [];
      const visible = items.slice(0, cardLimitPerCell);
      for (const item of visible) {
        out.push({
          id: `${item.slice.occurrenceRef}|${item.slice.day}`,
          event: item.event,
        });
      }
    }
    return out;
  }, [cells, eventsByDay, cardLimitPerCell]);

  return (
    <>
      <div className={styles.gridRoot} role="grid" aria-label="本月日历">
        <div className={styles.dowRow} role="row">
          {dowLabels.map((label) => (
            <div key={label} className={styles.dowCell} role="columnheader">{label}</div>
          ))}
        </div>
        <div className={styles.bodyScroll}>
          <div className={styles.gridBody} role="rowgroup">
            {chunkIntoWeeks(cells).map((week) => (
              // W4 grid ARIA fix: grid → rowgroup → row → gridcell. Mirrors
              // MonthGridDnd exactly so the Suspense swap never shifts the
              // ARIA structure. display:contents row keeps the CSS grid.
              <div key={week[0]?.stamp ?? 'week'} className={styles.gridRow} role="row">
                {week.map((cell) => {
                  const items = eventsByDay.get(cell.stamp) ?? [];
                  const visible = items.slice(0, cardLimitPerCell);
                  const overflow = items.length - visible.length;
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
                      <ul className={styles.eventList}>
                        {visible.map((item) => {
                          const entryId = `${item.slice.occurrenceRef}|${item.slice.day}`;
                          // SIK-139 W1 (F-2): two distinct chip handles, do not
                          // conflate them. `data-event-id` (= item.event.id, passed
                          // via optimisticPatch lookup + read by Wave 2 mutation) is
                          // the real reschedule/mutation target. `peekAnchorId`
                          // (= entryId `${occurrenceRef}|${day}`) is the per-slice
                          // peek/drag handle — unique per cross-day slice.
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
                        {overflow > 0 ? (
                          <li className={styles.moreLabel} data-testid="home-month-overflow">
                            +{overflow} 更多
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export interface MonthCalendarViewProps {
  /** See TodayCalendarViewProps for the standalone-render rationale. */
  readonly viewConfig?: CalendarViewConfig;
}

export function MonthCalendarView(props: MonthCalendarViewProps = {}) {
  // Provider mount lives at the view root so every chip below can call
  // useCalendarPeek(). Card renders a portal so its DOM escapes the grid
  // overflow context; nothing else changes about the view's layout.
  return (
    <CalendarPeekProvider>
      <MonthCalendarViewBody {...props} />
      <CalendarPeekCard />
    </CalendarPeekProvider>
  );
}

function MonthCalendarViewBody({ viewConfig }: MonthCalendarViewProps) {
  const anchorDate = usePlanStore((s) => s.currentDate);
  const config = viewConfig ?? createDefaultCalendarViewConfig('month');
  const window = useMemo(
    () => buildViewRange('month', { anchorDate, timeZone: TZ, startWeekOnMonday: config.startWeekOnMonday }),
    [anchorDate, config.startWeekOnMonday],
  );
  const query = useEvents({ from: window.from, to: window.to, tz: TZ, includePracticeBlocks: false });
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
        <div className={styles.stateWrap} role="status" aria-label="本月日历加载中" data-testid="home-month-loading">
          <Skeleton variant="rect" height={32} />
          <Skeleton variant="rect" height={96} />
        </div>
      ) : null}
      {query.isError ? (
        <div className={styles.stateWrap} role="alert" data-testid="home-month-error">
          <div className={styles.errorCard}>
            <span className={styles.errorCardTitle}>无法加载本月日历</span>
            <span>{String((query.error as Error | null)?.message ?? 'Network error')}</span>
            <button type="button" className={styles.retry} onClick={() => { void query.refetch(); }}>重试</button>
          </div>
        </div>
      ) : null}
      {query.isSuccess && total === 0 ? (
        <div className={styles.stateWrap} data-testid="home-month-empty">
          <EmptyState title="本月尚无事件" description="可在“开始今日练习”CTA 中创建一次专项练习。" />
        </div>
      ) : null}
      {query.isSuccess && total > 0 ? (
        // SIK-139 W1: progressively enhance to the dnd-enabled grid. The
        // static MonthGrid renders as the Suspense fallback (identical DOM,
        // no drag) so first paint / LCP never waits on the lazy dnd chunk;
        // MonthGridDnd swaps in once @dnd-kit loads.
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
