// lint-allow-ui-copy: V5 SIK-126 Month calendar copy. CJK strings are
// visual contract from `.tmp_review/out/Tab1-Home/Home v2.1.html`.
import { useMemo } from 'react';
import { useEvents } from '@sikao/api-client/plansQueries';
import { buildViewRange } from '@sikao/calendar-engine';
import { usePlanStore } from '@sikao/domain';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
import { Skeleton } from '../../../components/atom/Skeleton';
import { EmptyState } from '../../../components/atom/EmptyState';
import { eventKindOf } from './eventKind';
import {
  createDefaultCalendarViewConfig,
  type CalendarViewConfig,
} from './calendarViewConfig';
import styles from './MonthCalendarView.module.css';

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
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const monthStart = new Date(year, month, 1);
  // Requirement 4: Monday-first uses (day + 6) % 7; Sunday-first uses day.
  const offset = startWeekOnMonday ? (monthStart.getDay() + 6) % 7 : monthStart.getDay();
  const gridStart = new Date(year, month, 1 - offset);
  const today = todayStamp();
  // 6 weeks x 7 days = 42 cells covers any month layout.
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const stamp = localStamp(d);
    return {
      stamp, dom: d.getDate(), inMonth: d.getMonth() === month,
      isToday: stamp === today,
    };
  });
}

function bucketEventsByDay(events: ReadonlyArray<PlanEventReadV2>): Map<string, PlanEventReadV2[]> {
  const map = new Map<string, PlanEventReadV2[]>();
  for (const event of events) {
    const stamp = localStamp(new Date(event.startAt));
    const bucket = map.get(stamp);
    if (bucket) bucket.push(event);
    else map.set(stamp, [event]);
  }
  return map;
}

function MonthGrid({ cells, eventsByDay, dowLabels, cardLimitPerCell }: {
  readonly cells: ReadonlyArray<MonthCell>;
  readonly eventsByDay: ReadonlyMap<string, ReadonlyArray<PlanEventReadV2>>;
  readonly dowLabels: ReadonlyArray<string>;
  readonly cardLimitPerCell: number;
}) {
  return (
    <>
      <div className={styles.dowRow} role="row">
        {dowLabels.map((label) => (
          <div key={label} className={styles.dowCell} role="columnheader">{label}</div>
        ))}
      </div>
      <div className={styles.bodyScroll}>
        <div className={styles.gridBody} role="grid" aria-label="本月日历">
          {cells.map((cell) => {
            const events = eventsByDay.get(cell.stamp) ?? [];
            const visible = events.slice(0, cardLimitPerCell);
            const overflow = events.length - visible.length;
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
                  {visible.map((event) => (
                    <li
                      key={event.id}
                      className={styles.eventChip}
                      data-testid="home-month-event"
                      data-kind={eventKindOf(event)}
                      title={event.title}
                    >
                      {event.title}
                    </li>
                  ))}
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
      </div>
    </>
  );
}

export interface MonthCalendarViewProps {
  /** See TodayCalendarViewProps for the standalone-render rationale. */
  readonly viewConfig?: CalendarViewConfig;
}

export function MonthCalendarView({ viewConfig }: MonthCalendarViewProps = {}) {
  const anchorDate = usePlanStore((s) => s.currentDate);
  const config = viewConfig ?? createDefaultCalendarViewConfig('month');
  const window = useMemo(() => buildViewRange('month', { anchorDate, timeZone: TZ }), [anchorDate]);
  const query = useEvents({ from: window.from, to: window.to, tz: TZ, includePracticeBlocks: false });
  const cells = useMemo(
    () => buildMonthCells(anchorDate, config.startWeekOnMonday),
    [anchorDate, config.startWeekOnMonday],
  );
  const dowLabels = config.startWeekOnMonday ? DOW_LABELS_MON_FIRST : DOW_LABELS_SUN_FIRST;
  const eventsByDay = useMemo(() => bucketEventsByDay(query.data?.data.events ?? []), [query.data]);
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
        <MonthGrid
          cells={cells}
          eventsByDay={eventsByDay}
          dowLabels={dowLabels}
          cardLimitPerCell={config.cardLimitPerCell}
        />
      ) : null}
    </div>
  );
}
