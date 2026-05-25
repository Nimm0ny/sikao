// lint-allow-ui-copy: V5 D.4.1 bottomRow #1 "本周备考回顾" copy. CJK strings
// are visual contract from sik-fu-a-home-visual-contract.md §2.4.
import { useMemo } from 'react';
import { useDashboardWeeklyPlan } from '@sikao/api-client/dashboardQueries';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
import { Skeleton } from '../../../components/atom/Skeleton';
import { EmptyState } from '../../../components/atom/EmptyState';
import styles from './WeeklyReviewSection.module.css';

/*
 * WeeklyReviewSection — Home Section A · bottomRow #1.
 *
 * Why: sik-fu-a-home-visual-contract.md §2.4 — replaces PLACEHOLDER_TASKS
 *      with the V5 prototype "本周备考回顾" widget:
 *        - 64×64 circular ring (completion %)
 *        - feed-pill "坚持 N 天" (streak derived from week dots)
 *        - 7 dots (Mon–Sun) with full / half / empty states
 *
 *      Data source: useDashboardWeeklyPlan().summary.completionRate +
 *      events array bucketed by local date (3-state: done = full,
 *      planned/in_progress = half, missing = empty).
 *
 *      AGENT-H7: 4 states (loading / error / empty / ready). No
 *      `?? defaultValue` over arbitrary API output — all numeric reads
 *      go through Number.parseFloat with Number.isFinite gate.
 */

type DotState = 'full' | 'half' | 'empty';

const RING_SIZE = 64;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const DOW_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function thisWeekStamps(now: Date = new Date()): ReadonlyArray<string> {
  const offset = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localStamp(d);
  });
}

function dotsFromEvents(events: ReadonlyArray<PlanEventReadV2>, weekStamps: ReadonlyArray<string>): ReadonlyArray<DotState> {
  // Bucket each day's events: done = full, any planned/in_progress = half, none = empty.
  const map = new Map<string, { done: number; other: number }>();
  for (const stamp of weekStamps) map.set(stamp, { done: 0, other: 0 });
  for (const event of events) {
    const stamp = localStamp(new Date(event.startAt));
    const bucket = map.get(stamp);
    if (!bucket) continue;
    if (event.status === 'done') bucket.done += 1;
    else bucket.other += 1;
  }
  return weekStamps.map((stamp) => {
    const b = map.get(stamp);
    if (!b) return 'empty';
    if (b.done > 0 && b.other === 0) return 'full';
    if (b.done > 0 || b.other > 0) return 'half';
    return 'empty';
  });
}

function parseRate(input: string | null | undefined): number {
  if (input === null || input === undefined) return 0;
  const n = Number.parseFloat(input);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function streakFromDots(dots: ReadonlyArray<DotState>): number {
  let count = 0;
  for (const dot of dots) {
    if (dot === 'full' || dot === 'half') count += 1;
    else break;
  }
  return count;
}

function CompletionRing({ rate }: { readonly rate: number }) {
  const dashOffset = RING_CIRC * (1 - rate);
  const pct = Math.round(rate * 100);
  return (
    <svg
      className={styles.ring}
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      role="img"
      aria-label={`本周完成率 ${pct}%`}
      data-testid="weekly-review-ring"
    >
      <circle
        className={styles.ringTrack}
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={RING_STROKE}
      />
      <circle
        className={styles.ringFill}
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={RING_STROKE}
        strokeDasharray={RING_CIRC}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
      <text
        x="50%"
        y="50%"
        className={styles.ringText}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {pct}%
      </text>
    </svg>
  );
}

export function WeeklyReviewSection() {
  const query = useDashboardWeeklyPlan();
  const weekStamps = useMemo(() => thisWeekStamps(), []);
  const events = query.data?.events ?? [];
  const dots = useMemo(() => dotsFromEvents(events, weekStamps), [events, weekStamps]);
  const rate = parseRate(query.data?.summary.completionRate);
  const streak = streakFromDots(dots);

  if (query.isLoading) {
    return (
      <div className={styles.root} data-testid="weekly-review-loading" role="status" aria-label="本周备考回顾加载中">
        <Skeleton variant="rect" height={64} width={64} />
        <Skeleton variant="text" lines={2} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={styles.root} data-testid="weekly-review-error">
        <EmptyState
          title="无法加载本周回顾"
          description={String((query.error as Error | null)?.message ?? 'Network error')}
        />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={styles.root} data-testid="weekly-review-empty">
        <EmptyState title="本周尚无练习" description="开始今日练习以累计本周进度。" />
      </div>
    );
  }

  return (
    <div className={styles.root} data-testid="weekly-review">
      <div className={styles.head}>
        <CompletionRing rate={rate} />
        <span className={styles.streakPill} data-testid="weekly-review-streak">
          坚持 <b className={styles.streakNum}>{streak}</b> 天
        </span>
      </div>
      <ol className={styles.dotsRow} aria-label="本周打卡" data-testid="weekly-review-dots">
        {dots.map((dot, idx) => (
          <li
            key={weekStamps[idx]}
            className={styles.dot}
            data-state={dot}
            aria-label={`周${DOW_LABELS[idx]} ${dot === 'full' ? '已完成' : dot === 'half' ? '进行中' : '未开始'}`}
          >
            <span className={styles.dotCore} aria-hidden="true" />
            <span className={styles.dotLabel}>{DOW_LABELS[idx]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
