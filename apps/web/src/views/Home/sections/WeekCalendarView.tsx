// lint-allow-ui-copy: V5 SIK-126 Week calendar copy. CJK strings are
// visual contract from `.tmp_review/out/Tab1-Home/Home v2.1.html`.
import { useMemo } from 'react';
import { useEvents } from '@sikao/api-client/plansQueries';
import { buildViewRange, type CrossDaySlice } from '@sikao/calendar-engine';
import { usePlanStore } from '@sikao/domain';
import { zonedDateKey } from '@sikao/shared-utils';
import { Skeleton } from '../../../components/atom/Skeleton';
import { EmptyState } from '../../../components/atom/EmptyState';
import { MonthEventChip } from './MonthEventChip';
import { expandPlanEventsForView, type EnrichedOccurrence } from './calendarEvents';
import {
  createDefaultCalendarViewConfig,
  type CalendarViewConfig,
} from './calendarViewConfig';
import styles from './WeekCalendarView.module.css';

/*
 * WeekCalendarView — V5 SIK-126 (Home v2.1 week view).
 *
 * Why: 7 columns x 3 row slot grid. Rows are time-of-day buckets:
 *      早上 06:00–12:00, 中午 12:00–18:00, 晚上 18:00–06:00 (next day).
 *      Each cell renders a dc-label heading and 0..N day-event chips.
 *      Empty cells render the dc-empty placeholder. Today column gets
 *      the brand-soft tint. Chip colors come from eventKindOf().
 *
 *      AGENT-H7: 4-state contract identical to Today / Month;
 *      isLoading / isError / empty / ready surface from query.* directly.
 *
 *      SIK-138 W4: `startWeekOnMonday` from CalendarViewConfig drives both
 *      the DOW header order and the grid-start offset. Default config
 *      keeps Monday-first; setting `startWeekOnMonday=false` swaps to
 *      Sunday-first per Requirement 4.
 *
 *      SIK-138 W4.5 (D16): events run through `expandPlanEventsForView`
 *      so recurring rules emit one chip per occurrence inside the week
 *      window.
 */

const TZ = 'Asia/Shanghai';
const DOW_LABELS_MON_FIRST = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;
const DOW_LABELS_SUN_FIRST = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
const SLOT_LABELS = ['早上', '中午', '晚上'] as const;

type SlotIndex = 0 | 1 | 2;

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (v: Date) => `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
const todayStamp = () => localStamp(new Date());

interface WeekDay {
  readonly stamp: string;
  readonly dom: number;
  readonly dowIndex: number;
  readonly isToday: boolean;
}

function buildWeekDays(anchorDate: string, startWeekOnMonday: boolean): WeekDay[] {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  // Requirement 4: Monday-first uses (day + 6) % 7; Sunday-first uses day.
  const offset = startWeekOnMonday ? (anchor.getDay() + 6) % 7 : anchor.getDay();
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - offset);
  const today = todayStamp();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const stamp = localStamp(d);
    return { stamp, dom: d.getDate(), dowIndex: i, isToday: stamp === today };
  });
}

function slotForHour(hour: number): SlotIndex {
  if (hour >= 6 && hour < 12) return 0; // 早上
  if (hour >= 12 && hour < 18) return 1; // 中午
  return 2; // 晚上 (18-23 + 0-5)
}

/**
 * Build a single-day slice for a week occurrence so MonthEventChip can anchor
 * its tone (§3.2) on the occurrence's local day. The week buckets one chip per
 * (day, slot) and never spans cells, so `day` = the occurrence start day and
 * both slice ends mark a complete (non-cross-day) slice.
 *
 * H7 / contract §3.2: the tone anchor day is the Asia/Shanghai calendar day
 * (via `zonedDateKey`, throws on a bad timestamp) — NOT the browser-local day —
 * so the chip tone matches the month path regardless of the host time zone.
 */
function weekDaySlice(item: EnrichedOccurrence): CrossDaySlice {
  const day = zonedDateKey(item.occurrence.startAt, TZ);
  return {
    occurrenceRef: item.occurrence.occurrenceRef,
    day,
    sliceStartAt: item.occurrence.startAt,
    sliceEndAt: item.occurrence.endAt,
    isStartSlice: true,
    isEndSlice: true,
  };
}

function bucketEvents(items: ReadonlyArray<EnrichedOccurrence>): Map<string, EnrichedOccurrence[]> {
  // Key = `{stamp}|{slotIndex}` — one bucket per (day, time-of-day slot).
  const map = new Map<string, EnrichedOccurrence[]>();
  for (const item of items) {
    const start = new Date(item.occurrence.startAt);
    const key = `${localStamp(start)}|${slotForHour(start.getHours())}`;
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function WeekGrid({ days, eventsByCell, dowLabels, visibleProperties, today }: {
  readonly days: ReadonlyArray<WeekDay>;
  readonly eventsByCell: ReadonlyMap<string, ReadonlyArray<EnrichedOccurrence>>;
  readonly dowLabels: ReadonlyArray<string>;
  readonly visibleProperties: CalendarViewConfig['visibleProperties'];
  readonly today: string;
}) {
  // Cells are laid out row-first: slot 0 across all 7 days, slot 1, slot 2.
  const slotIndices: ReadonlyArray<SlotIndex> = [0, 1, 2];
  return (
    <>
      <div className={styles.calHead} role="row">
        {days.map((d) => (
          <div
            key={d.stamp}
            role="columnheader"
            className={styles.cellDay}
            data-today={d.isToday || undefined}
            data-testid={`home-week-head-${d.stamp}`}
          >
            <span className={styles.dLabel}>
              {dowLabels[d.dowIndex]}{d.isToday ? ' · 今日' : ''}
            </span>
            <span className={styles.dNum}>{d.dom}</span>
          </div>
        ))}
      </div>
      <div className={styles.calBody} role="grid" aria-label="本周日历">
        {slotIndices.flatMap((slot) =>
          days.map((d) => {
            const bucket = eventsByCell.get(`${d.stamp}|${slot}`) ?? [];
            return (
              <div
                key={`${d.stamp}-${slot}`}
                role="gridcell"
                className={styles.dayCell}
                data-today={d.isToday || undefined}
                data-testid={`home-week-cell-${d.stamp}-${slot}`}
              >
                <span className={styles.dcLabel}>{SLOT_LABELS[slot]}</span>
                {bucket.length === 0 ? (
                  <span className={styles.dcEmpty}>无安排</span>
                ) : (
                  bucket.map((item) => (
                    // SIK-142 W1: week reuses MonthEventChip for unified
                    // geometry / tone / channels. Read-only here (no drag, no
                    // onClick); W5 wires onClick → read-only Peek.
                    <div
                      key={item.occurrence.id}
                      className={styles.dayEventSlot}
                      data-testid="home-week-event"
                    >
                      <MonthEventChip
                        event={item.event}
                        slice={weekDaySlice(item)}
                        visibleProperties={visibleProperties}
                        today={today}
                      />
                    </div>
                  ))
                )}
              </div>
            );
          }),
        )}
      </div>
    </>
  );
}

export interface WeekCalendarViewProps {
  /** See TodayCalendarViewProps for the standalone-render rationale. */
  readonly viewConfig?: CalendarViewConfig;
}

export function WeekCalendarView({ viewConfig }: WeekCalendarViewProps = {}) {
  const anchorDate = usePlanStore((s) => s.currentDate);
  const config = viewConfig ?? createDefaultCalendarViewConfig('week');
  const window = useMemo(
    () => buildViewRange('week', { anchorDate, timeZone: TZ, startWeekOnMonday: config.startWeekOnMonday }),
    [anchorDate, config.startWeekOnMonday],
  );
  const query = useEvents({ from: window.from, to: window.to, tz: TZ, includePracticeBlocks: false });
  const days = useMemo(
    () => buildWeekDays(anchorDate, config.startWeekOnMonday),
    [anchorDate, config.startWeekOnMonday],
  );
  const dowLabels = config.startWeekOnMonday ? DOW_LABELS_MON_FIRST : DOW_LABELS_SUN_FIRST;
  const occurrences = useMemo(
    () => expandPlanEventsForView(query.data?.data.events ?? [], window),
    [query.data, window],
  );
  const eventsByCell = useMemo(() => bucketEvents(occurrences), [occurrences]);
  const total = query.data?.data.events.length ?? 0;

  return (
    <div className={styles.root} data-testid="home-week-calendar">
      {query.isLoading ? (
        <div className={styles.stateWrap} role="status" aria-label="本周日历加载中" data-testid="home-week-loading">
          <Skeleton variant="rect" height={32} />
          <Skeleton variant="rect" height={64} />
        </div>
      ) : null}
      {query.isError ? (
        <div className={styles.stateWrap} role="alert" data-testid="home-week-error">
          <div className={styles.errorCard}>
            <span className={styles.errorCardTitle}>无法加载本周日历</span>
            <span>{String((query.error as Error | null)?.message ?? 'Network error')}</span>
            <button type="button" className={styles.retry} onClick={() => { void query.refetch(); }}>重试</button>
          </div>
        </div>
      ) : null}
      {query.isSuccess && total === 0 ? (
        <div className={styles.stateWrap} data-testid="home-week-empty">
          <EmptyState title="本周尚无事件" description="切换到“今日”或“月”视图查看其它窗口的计划。" />
        </div>
      ) : null}
      {query.isSuccess && total > 0 ? (
        <WeekGrid
          days={days}
          eventsByCell={eventsByCell}
          dowLabels={dowLabels}
          visibleProperties={config.visibleProperties}
          today={zonedDateKey(new Date().toISOString(), TZ)}
        />
      ) : null}
    </div>
  );
}
