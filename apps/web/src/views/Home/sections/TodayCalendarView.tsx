// lint-allow-ui-copy: V5 D.4.1 Today calendar copy. CJK strings are visual
// contract from the V5 prototype and Home Phase 04-Frontend-WU §F4.2; will
// route through ui-copy SSOT during Home Phase Closeout.
import { useMemo } from 'react';
import { useEvents } from '@sikao/api-client/plansQueries';
import { buildViewRange } from '@sikao/calendar-engine';
import { usePlanStore } from '@sikao/domain';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
import { Skeleton } from '../../../components/atom/Skeleton';
import { EmptyState } from '../../../components/atom/EmptyState';
import { EventBlock } from './EventBlock';
import styles from './TodayCalendarView.module.css';

/*
 * TodayCalendarView — Home Section A · Today canvas.
 *
 * Why: 24h × 48px-per-hour grid bound to plansQueries.useEvents over the
 *      [start-of-today, end-of-today] window built by calendar-engine
 *      (timezone-correct via fromZonedTime). Implements the 4-state
 *      contract from plan §3.2 Acceptance:
 *        loading → Skeleton stack inside the canvas frame
 *        error   → inline ErrorCard with retry CTA
 *        empty   → EmptyState ("今日尚无事件")
 *        ready   → absolute-positioned event blocks indexed by hour
 *
 *      EventBlock is inlined here for Wave 1 commit 2; Wave 3 lifts it
 *      into a dedicated primitive once Week / Month bodies share shape.
 *
 *      AGENT-H7: 4 states reflect isLoading / isError / data?.data.events
 *      directly; no `?? defaultValue` coercion. Errors surface via the
 *      ErrorCard with a manual refetch CTA.
 */

const TZ = 'Asia/Shanghai';
const HOUR_HEIGHT_PX = 48;
const MIN_BLOCK_HEIGHT_PX = 24;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function geometryFor(event: PlanEventReadV2): { top: number; height: number } {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const minutesFromMidnight = (start.getTime() - dayStart.getTime()) / 60_000;
  const durationMinutes = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
  return {
    top: (minutesFromMidnight / 60) * HOUR_HEIGHT_PX,
    height: Math.max(MIN_BLOCK_HEIGHT_PX, (durationMinutes / 60) * HOUR_HEIGHT_PX),
  };
}

function HourGutter() {
  return (
    <div className={styles.hours} aria-hidden="true">
      {Array.from({ length: 24 }, (_, hour) => (
        <span
          key={hour}
          className={styles.hourLabel}
          style={{ top: `${hour * HOUR_HEIGHT_PX}px` }}
        >
          {pad(hour)}:00
        </span>
      ))}
    </div>
  );
}

export function TodayCalendarView() {
  const anchorDate = usePlanStore((s) => s.currentDate);
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
          <Skeleton variant="rect" height={48} />
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
          <EmptyState title="今日尚无事件" description="可在“开始练习”CTA 中创建一次专项练习，或等待 AI 自动制定。" />
        </div>
      ) : null}
      {query.isSuccess && events.length > 0 ? (
        <div className={styles.canvas}>
          <HourGutter />
          <div className={styles.grid}>
            {events.map((event) => {
              const { top, height } = geometryFor(event);
              return (
                <EventBlock
                  key={event.id}
                  event={event}
                  style={{ top: `${top}px`, height: `${height}px` }}
                  testId="home-today-event"
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
