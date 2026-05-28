// lint-allow-ui-copy: V5 SIK-126 Today calendar copy. CJK strings are
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
import styles from './TodayCalendarView.module.css';

/*
 * TodayCalendarView — V5 SIK-126 (Home v2.1 today view).
 *
 * Why: 12 horizontal columns, each = 2 hours (--hour-col-w = 120px). A
 *      single overflow-x scroller wraps head + body so both scroll
 *      together; no JS scrollLeft sync. Events absolute-positioned by
 *      `left = startHour * 60px` (60px per hour, since 2h = 120px) with
 *      `width = max(60, durationHours * 60)`. Empty time spans render
 *      blank — no zero-height filler rows.
 *
 *      AGENT-H7: 4-state contract identical to Week / Month views;
 *      isLoading / isError / empty / ready surface from query.* directly.
 *
 *      SIK-138 W4: accepts `viewConfig` to satisfy Requirement 1 (one
 *      config object shared across the three views). Today V1 does not
 *      consume `startWeekOnMonday` / `cardLimitPerCell` directly, but the
 *      prop is reserved so future presets (chip density / detail-mode
 *      visibleProperties) can drive the strip without touching the panel.
 */

const TZ = 'Asia/Shanghai';
const PX_PER_HOUR = 60;
const MIN_BLOCK_PX = 60;
const HOUR_LABELS = Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, '0')}:00`);

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function geometryFor(event: PlanEventReadV2): { left: number; width: number } {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const startHour = (start.getTime() - dayStart.getTime()) / 3_600_000;
  const durationHours = Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
  return {
    left: startHour * PX_PER_HOUR,
    width: Math.max(MIN_BLOCK_PX, durationHours * PX_PER_HOUR),
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventBlock({ event }: { readonly event: PlanEventReadV2 }) {
  const { left, width } = geometryFor(event);
  const kind = eventKindOf(event);
  return (
    <article
      className={styles.event}
      data-testid="home-today-event"
      data-kind={kind}
      data-status={event.status}
      style={{ left: `${left}px`, width: `${width}px` }}
      title={event.title}
    >
      <span className={styles.eventTitle}>{event.title}</span>
      <span className={styles.eventTime}>
        {formatTime(event.startAt)} – {formatTime(event.endAt)}
      </span>
      {event.notes ? (
        <span className={styles.eventDetail}>{event.notes}</span>
      ) : null}
    </article>
  );
}

export interface TodayCalendarViewProps {
  /**
   * Optional explicit config; when omitted the component falls back to
   * `createDefaultCalendarViewConfig('today')`. CalendarPanel always
   * supplies one in production; tests and storybook may render the view
   * standalone without wiring the panel.
   */
  readonly viewConfig?: CalendarViewConfig;
}

export function TodayCalendarView({ viewConfig }: TodayCalendarViewProps = {}) {
  const anchorDate = usePlanStore((s) => s.currentDate);
  // viewConfig is reserved for future detail-mode hooks (D19/D20). Today V1
  // does not branch on it; reading the field here keeps the unused-prop
  // lint quiet without disabling the rule.
  void (viewConfig ?? createDefaultCalendarViewConfig('today'));
  const window = useMemo(
    () => buildViewRange('today', { anchorDate, timeZone: TZ }),
    [anchorDate],
  );
  const query = useEvents({
    from: window.from,
    to: window.to,
    tz: TZ,
    includePracticeBlocks: false,
  });
  const events = query.data?.data.events ?? [];

  return (
    <div className={styles.root} data-testid="home-today-calendar">
      {query.isLoading ? (
        <div className={styles.stateWrap} role="status" aria-label="今日日历加载中" data-testid="home-today-loading">
          <Skeleton variant="rect" height={32} />
          <Skeleton variant="rect" height={64} />
        </div>
      ) : null}
      {query.isError ? (
        <div className={styles.stateWrap} role="alert" data-testid="home-today-error">
          <div className={styles.errorCard}>
            <span className={styles.errorCardTitle}>无法加载今日日历</span>
            <span>{String((query.error as Error | null)?.message ?? 'Network error')}</span>
            <button type="button" className={styles.retry} onClick={() => { void query.refetch(); }}>重试</button>
          </div>
        </div>
      ) : null}
      {query.isSuccess && events.length === 0 ? (
        <div className={styles.stateWrap} data-testid="home-today-empty">
          <EmptyState title="今日尚无事件" description="可在“开始今日练习”CTA 中创建一次专项练习，或等待 AI 自动制定。" />
        </div>
      ) : null}
      {query.isSuccess && events.length > 0 ? (
        <div className={styles.scroller}>
          <div className={styles.scrollerInner}>
            <div className={styles.head} aria-hidden="true">
              {HOUR_LABELS.map((label) => (
                <span key={label} className={styles.cellHour}>{label}</span>
              ))}
            </div>
            <div className={styles.body}>
              {events.map((event) => (
                <EventBlock key={event.id} event={event} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
