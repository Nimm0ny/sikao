// lint-allow-ui-copy: V5 SIK-126 Week calendar copy. CJK strings are
// visual contract from `.tmp_review/out/Tab1-Home/Home v2.1.html`.
import { useMemo } from 'react';
import { useEvents } from '@sikao/api-client/plansQueries';
import { buildViewRange, type CrossDaySlice } from '@sikao/calendar-engine';
import { usePlanStore } from '@sikao/domain';
import { zonedDateKey } from '@sikao/shared-utils';

import { EmptyState } from '../../../components/atom/EmptyState';
import { Skeleton } from '../../../components/atom/Skeleton';
import { expandPlanEventsForView, type EnrichedOccurrence } from './calendarEvents';
import {
  createDefaultCalendarViewConfig,
  type CalendarViewConfig,
} from './calendarViewConfig';
import { MonthEventChip } from './MonthEventChip';
import { useCalendarEventAggregates, type CalendarAggregateQueryState } from './eventAggregates';
import {
  CalendarPeekCard,
  CalendarPeekProvider,
  useCalendarPeek,
  type CalendarPeekListEntry,
} from './peek';
import styles from './WeekCalendarView.module.css';

const TZ = 'Asia/Shanghai';
const DOW_LABELS_MON_FIRST = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;
const DOW_LABELS_SUN_FIRST = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
const SLOT_LABELS = ['早上', '中午', '晚上'] as const;

type SlotIndex = 0 | 1 | 2;
const SLOT_INDICES: ReadonlyArray<SlotIndex> = [0, 1, 2];

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const todayStamp = () => localStamp(new Date());
const buildVisibleRowsMaxHeight = (visibleRows: number) =>
  `calc(${visibleRows} * var(--space-8) + ${Math.max(visibleRows - 1, 0)} * var(--space-1))`;

interface WeekDay {
  readonly stamp: string;
  readonly dom: number;
  readonly dowIndex: number;
  readonly isToday: boolean;
}

function buildWeekDays(anchorDate: string, startWeekOnMonday: boolean): WeekDay[] {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const offset = startWeekOnMonday ? (anchor.getDay() + 6) % 7 : anchor.getDay();
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - offset);
  const today = todayStamp();
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const stamp = localStamp(day);
    return { stamp, dom: day.getDate(), dowIndex: index, isToday: stamp === today };
  });
}

function slotForHour(hour: number): SlotIndex {
  if (hour >= 6 && hour < 12) return 0;
  if (hour >= 12 && hour < 18) return 1;
  return 2;
}

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

function buildWeekPeekEntry(item: EnrichedOccurrence): CalendarPeekListEntry {
  return {
    id: `${item.occurrence.occurrenceRef}|${weekDaySlice(item).day}`,
    event: item.event,
  };
}

function compareWeekPeekEntries(a: CalendarPeekListEntry, b: CalendarPeekListEntry): number {
  const startDiff = new Date(a.event.startAt).getTime() - new Date(b.event.startAt).getTime();
  if (startDiff !== 0) return startDiff;
  const endDiff = new Date(a.event.endAt).getTime() - new Date(b.event.endAt).getTime();
  if (endDiff !== 0) return endDiff;
  return a.id.localeCompare(b.id);
}

function WeekGrid({
  days,
  eventsByCell,
  dowLabels,
  visibleProperties,
  today,
  cardLimitPerCell,
  aggregateState,
}: {
  readonly days: ReadonlyArray<WeekDay>;
  readonly eventsByCell: ReadonlyMap<string, ReadonlyArray<EnrichedOccurrence>>;
  readonly dowLabels: ReadonlyArray<string>;
  readonly visibleProperties: CalendarViewConfig['visibleProperties'];
  readonly today: string;
  readonly cardLimitPerCell: number;
  readonly aggregateState: CalendarAggregateQueryState;
}) {
  const peek = useCalendarPeek();
  const peekList = useMemo<ReadonlyArray<CalendarPeekListEntry>>(() => {
    const out: CalendarPeekListEntry[] = [];
    for (const day of days) {
      for (const slot of SLOT_INDICES) {
        const bucket = eventsByCell.get(`${day.stamp}|${slot}`) ?? [];
        for (const item of bucket) {
          out.push(buildWeekPeekEntry(item));
        }
      }
    }
    out.sort(compareWeekPeekEntries);
    return out;
  }, [days, eventsByCell]);
  return (
    <>
      <div className={styles.calHead} role="row">
        {days.map((day) => (
          <div
            key={day.stamp}
            role="columnheader"
            className={styles.cellDay}
            data-today={day.isToday || undefined}
            data-testid={`home-week-head-${day.stamp}`}
          >
            <span className={styles.dLabel}>
              {dowLabels[day.dowIndex]}
              {day.isToday ? ' · 今日' : ''}
            </span>
            <span className={styles.dNum}>{day.dom}</span>
          </div>
        ))}
      </div>
      <div className={styles.calBody} role="grid" aria-label="本周日历">
        {SLOT_INDICES.flatMap((slot) =>
          days.map((day) => {
            const bucket = eventsByCell.get(`${day.stamp}|${slot}`) ?? [];
            return (
              <div
                key={`${day.stamp}-${slot}`}
                role="gridcell"
                className={styles.dayCell}
                data-today={day.isToday || undefined}
                data-testid={`home-week-cell-${day.stamp}-${slot}`}
              >
                <span className={styles.dcLabel}>{SLOT_LABELS[slot]}</span>
                {bucket.length === 0 ? (
                  <span className={styles.dcEmpty}>无安排</span>
                ) : (
                  <div
                    className={styles.dayEventList}
                    data-testid={`home-week-event-list-${day.stamp}-${slot}`}
                    data-scrollable={bucket.length > cardLimitPerCell || undefined}
                    style={{ maxHeight: buildVisibleRowsMaxHeight(cardLimitPerCell) }}
                  >
                    {bucket.map((item) => {
                      const peekEntry = buildWeekPeekEntry(item);
                      return (
                        <div
                          key={item.occurrence.id}
                          className={styles.dayEventSlot}
                          data-testid="home-week-event"
                        >
                          <MonthEventChip
                            event={item.event}
                            aggregate={aggregateState.byEventId.get(item.event.id)}
                            aggregateState={aggregateState}
                            slice={weekDaySlice(item)}
                            visibleProperties={visibleProperties}
                            today={today}
                            peekAnchorId={peekEntry.id}
                            onClick={() => peek.open({ ...item.event, id: peekEntry.id }, peekList)}
                          />
                        </div>
                      );
                    })}
                  </div>
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
  readonly viewConfig?: CalendarViewConfig;
}

export function WeekCalendarView({ viewConfig }: WeekCalendarViewProps = {}) {
  return (
    <CalendarPeekProvider>
      <WeekCalendarViewBody viewConfig={viewConfig} />
      <CalendarPeekCard />
    </CalendarPeekProvider>
  );
}

function WeekCalendarViewBody({ viewConfig }: WeekCalendarViewProps) {
  const anchorDate = usePlanStore((state) => state.currentDate);
  const config = viewConfig ?? createDefaultCalendarViewConfig('week');
  const window = useMemo(
    () =>
      buildViewRange('week', {
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
  const days = useMemo(
    () => buildWeekDays(anchorDate, config.startWeekOnMonday),
    [anchorDate, config.startWeekOnMonday],
  );
  const dowLabels = config.startWeekOnMonday ? DOW_LABELS_MON_FIRST : DOW_LABELS_SUN_FIRST;
  const occurrences = useMemo(
    () => expandPlanEventsForView(query.data?.data.events ?? [], window),
    [query.data, window],
  );
  const aggregateEventIds = useMemo(() => occurrences.map((item) => item.event.id), [occurrences]);
  const aggregateState = useCalendarEventAggregates(aggregateEventIds);
  const eventsByCell = useMemo(() => bucketEvents(occurrences), [occurrences]);
  const visibleOccurrenceCount = occurrences.length;

  return (
    <div className={styles.root} data-testid="home-week-calendar">
      {query.isLoading ? (
        <div
          className={styles.stateWrap}
          role="status"
          aria-label="本周日历加载中"
          data-testid="home-week-loading"
        >
          <Skeleton variant="rect" height={32} />
          <Skeleton variant="rect" height={64} />
        </div>
      ) : null}
      {query.isError ? (
        <div className={styles.stateWrap} role="alert" data-testid="home-week-error">
          <div className={styles.errorCard}>
            <span className={styles.errorCardTitle}>无法加载本周日历</span>
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
      {query.isSuccess && visibleOccurrenceCount === 0 ? (
        <div className={styles.stateWrap} data-testid="home-week-empty">
          <EmptyState
            title="本周尚无事件"
            description="切换到“今日”或“月”视图查看其它窗口的计划。"
          />
        </div>
      ) : null}
      {query.isSuccess && visibleOccurrenceCount > 0 ? (
        <WeekGrid
          days={days}
          eventsByCell={eventsByCell}
          dowLabels={dowLabels}
          visibleProperties={config.visibleProperties}
          today={zonedDateKey(new Date().toISOString(), TZ)}
          cardLimitPerCell={config.cardLimitPerCell}
          aggregateState={aggregateState}
        />
      ) : null}
    </div>
  );
}
