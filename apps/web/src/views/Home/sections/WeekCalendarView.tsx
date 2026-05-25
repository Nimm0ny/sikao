// lint-allow-ui-copy: V5 D.4.1 Week calendar copy. CJK strings are visual
// contract from the V5 prototype and Home Phase 04-Frontend-WU §F4.3.
import { useMemo } from 'react';
import { useEvents } from '@sikao/api-client/plansQueries';
import { buildViewRange } from '@sikao/calendar-engine';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
import { Skeleton } from '../../../components/atom/Skeleton';
import { EmptyState } from '../../../components/atom/EmptyState';
import { EventBlock } from './EventBlock';
import styles from './WeekCalendarView.module.css';

/*
 * WeekCalendarView — Home Section A · Week canvas.
 * 7-column grid (Mon-Sun), each column is a 24h × 36px-per-hour strip.
 * Events bucketed by local date (Asia/Shanghai). Same 4-state contract
 * as TodayCalendarView (cross-day slicing lifted to Wave 3 EventBlock
 * primitive via calendar-engine.sliceOccurrenceByDay).
 */

const TZ = 'Asia/Shanghai';
const HOUR_H = 36;
const MIN_BLOCK_H = 18;
const DOW_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (v: Date) => `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
const todayStamp = () => localStamp(new Date());

interface WeekDay {
  readonly stamp: string;
  readonly dom: number;
  readonly dowIndex: number;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
}

function buildWeekDays(anchorDate: string): WeekDay[] {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const offset = (anchor.getDay() + 6) % 7;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - offset);
  const today = todayStamp();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const stamp = localStamp(d);
    return { stamp, dom: d.getDate(), dowIndex: i, isToday: stamp === today, isWeekend: i >= 5 };
  });
}

function geometryFor(event: PlanEventReadV2) {
  const s = new Date(event.startAt);
  const e = new Date(event.endAt);
  const minutes = s.getHours() * 60 + s.getMinutes();
  const dur = Math.max(0, (e.getTime() - s.getTime()) / 60_000);
  return { top: (minutes / 60) * HOUR_H, height: Math.max(MIN_BLOCK_H, (dur / 60) * HOUR_H) };
}

function WeekGrid({ days, eventsByDay }: {
  readonly days: ReadonlyArray<WeekDay>;
  readonly eventsByDay: ReadonlyMap<string, ReadonlyArray<PlanEventReadV2>>;
}) {
  return (
    <div className={styles.grid} role="grid" aria-label="本周日历">
      <div />
      {days.map((d) => (
        <div key={d.stamp} className={styles.dayHeader} data-today={d.isToday || undefined} role="columnheader">
          <span className={styles.dow}>{DOW_LABELS[d.dowIndex]}</span>
          <span className={styles.dom}>{d.dom}</span>
        </div>
      ))}
      <div className={styles.hourCol} aria-hidden="true">
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className={styles.hourLabel} style={{ top: `${h * HOUR_H}px` }}>{pad(h)}</span>
        ))}
      </div>
      {days.map((d) => (
        <div key={d.stamp} className={styles.dayCol} data-today={d.isToday || undefined} data-weekend={d.isWeekend || undefined} data-testid={`home-week-day-${d.stamp}`}>
          {(eventsByDay.get(d.stamp) ?? []).map((event) => {
            const { top, height } = geometryFor(event);
            return (
              <EventBlock
                key={event.id}
                event={event}
                density="compact"
                style={{ top: `${top}px`, height: `${height}px` }}
                testId="home-week-event"
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function WeekCalendarView() {
  const anchorDate = todayStamp();
  const window = useMemo(() => buildViewRange('week', { anchorDate, timeZone: TZ }), [anchorDate]);
  const query = useEvents({ from: window.from, to: window.to, tz: TZ, includePracticeBlocks: false });
  const days = useMemo(() => buildWeekDays(anchorDate), [anchorDate]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, PlanEventReadV2[]>();
    for (const event of query.data?.data.events ?? []) {
      const stamp = localStamp(new Date(event.startAt));
      const bucket = map.get(stamp);
      if (bucket) bucket.push(event);
      else map.set(stamp, [event]);
    }
    return map;
  }, [query.data]);
  const total = query.data?.data.events.length ?? 0;

  return (
    <div className={styles.root} data-testid="home-week-calendar">
      <header className={styles.head}>
        <h3 className={styles.headTitle}>本周</h3>
        <span className={styles.headMeta}>
          {days[0]?.stamp} – {days[6]?.stamp}
          {query.isSuccess ? ` · ${total} 个事件` : null}
        </span>
      </header>
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
      {query.isSuccess && total > 0 ? <WeekGrid days={days} eventsByDay={eventsByDay} /> : null}
    </div>
  );
}
