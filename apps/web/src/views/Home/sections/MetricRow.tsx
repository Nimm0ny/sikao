// lint-allow-ui-copy: SIK-125 Metric Row — page-skeleton CN strings for the
// V5 Home v2.1 prototype contract. Future i18n / SSOT migration tracked
// under future Phase 6+.
import {
  useDashboardTodayCompletion,
  useDashboardTodayReview,
} from '@sikao/api-client/dashboardQueries';
import { useProgressOverview } from '@sikao/api-client/progressQueries';
import { SpriteIcon } from '../../../components/atom';
import styles from './MetricRow.module.css';

/*
 * MetricRow — V5 SIK-125 (Home v2.1 metric-row contract).
 *
 * Why: 4-card KPI strip wired to real /api/v2/dashboard endpoints. Replaces
 *      the static PLACEHOLDER_METRICS in Home.tsx. Each card is one of:
 *      - countdown: nearestExamTarget.daysUntil + planSlice.rangeFrom
 *        progress track
 *      - today completion: doneEvents/totalEvents + completionRate
 *      - week progress: planSlice eventsDone/eventsInWindowTotal + minutes
 *        target ratio
 *      - review total: dashboard/today/review.total + weaknessTop3[0]
 *
 *      AGENT-H7: any missing field renders as '—' or omits the segment;
 *      no fabricated defaults / +N vs 昨日 placeholders.
 */

const NULL_VALUE = '—';

interface MetricCardProps {
  readonly testId: string;
  readonly iconId: string;
  readonly iconTone?: 'warn' | 'err';
  readonly value: string;
  readonly unit?: string;
  readonly label: string;
  readonly delta?: { readonly text: string; readonly tone?: 'ok' | 'warn' | 'err' };
  readonly progress?: { readonly elapsed: number; readonly total: number };
}

function MetricCard({
  testId, iconId, iconTone, value, unit, label, delta, progress,
}: MetricCardProps) {
  return (
    <article className={styles.card} data-testid={testId}>
      <span
        className={styles.iconSlot}
        data-tone={iconTone}
        aria-hidden="true"
      >
        <SpriteIcon id={iconId} size={18} />
      </span>
      <div className={styles.data}>
        <div className={styles.value}>
          {value}
          {unit !== undefined ? <span className={styles.unit}>{unit}</span> : null}
        </div>
        <div className={styles.label}>{label}</div>
        {delta !== undefined ? (
          <div className={styles.delta} data-tone={delta.tone}>
            {delta.text}
          </div>
        ) : null}
        {progress !== undefined ? (
          <ProgressTrack elapsed={progress.elapsed} total={progress.total} />
        ) : null}
      </div>
    </article>
  );
}

function ProgressTrack({ elapsed, total }: { readonly elapsed: number; readonly total: number }) {
  // Clamp elapsed/total to [0, 1] so a defensive over-shoot does not break
  // the layout. Total === 0 means the plan has no usable range; the caller
  // should already guard via planSlice.rangeFrom !== null.
  const ratio = total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : 0;
  const pct = ratio * 100;
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label="备考进度"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  );
}

function parsePctString(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  // Backend ratios serialize as 0..1 strings; convert to whole-number %.
  return Math.round(num * 100);
}

function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return null;
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function MetricRow() {
  const progressQuery = useProgressOverview();
  const todayCompletionQuery = useDashboardTodayCompletion();
  const todayReviewQuery = useDashboardTodayReview();

  const exam = progressQuery.data?.nearestExamTarget ?? null;
  const planSlice = progressQuery.data?.summary.planSlice ?? null;
  const weaknessTop = progressQuery.data?.weaknessTop3?.[0] ?? null;

  // Card 1: countdown.
  const countdown = (() => {
    if (!exam) return { value: `D-${NULL_VALUE}`, label: '国考倒计时' };
    const total = planSlice?.rangeFrom
      ? daysBetweenIso(planSlice.rangeFrom, exam.examDate)
      : null;
    const elapsed =
      total !== null && Number.isFinite(total) ? total - exam.daysUntil : null;
    const showTrack = total !== null && total > 0 && elapsed !== null && elapsed >= 0;
    return {
      value: `D-${exam.daysUntil}`,
      label: `${exam.examName}倒计时`,
      progress: showTrack && total !== null && elapsed !== null
        ? { elapsed, total }
        : undefined,
    };
  })();

  // Card 2: today plan completion.
  const todayCompletion = todayCompletionQuery.data;
  const completionPct = parsePctString(todayCompletion?.completionRate ?? null);
  const card2 = {
    value: todayCompletion
      ? `${todayCompletion.doneEvents}/${todayCompletion.totalEvents}`
      : NULL_VALUE,
    label: '今日核心计划',
    delta: completionPct !== null
      ? { text: `${completionPct}% 已完成` }
      : undefined,
  };

  // Card 3: week progress (planSlice).
  const card3 = (() => {
    if (!planSlice) {
      return { value: NULL_VALUE, unit: '%', label: '本周复习进度' };
    }
    const pct = planSlice.eventsInWindowTotal > 0
      ? Math.round((planSlice.eventsDone / planSlice.eventsInWindowTotal) * 100)
      : 0;
    let deltaText: string;
    if (planSlice.minutesTargetInWindow > 0) {
      const targetPct = Math.round(
        (planSlice.minutesPracticedInWindow / planSlice.minutesTargetInWindow) * 100,
      );
      deltaText = `达成目标 ${targetPct}%`;
    } else {
      deltaText = '无目标';
    }
    return {
      value: String(pct),
      unit: '%',
      label: '本周复习进度',
      delta: { text: deltaText, tone: 'ok' as const },
    };
  })();

  // Card 4: review total + top weakness.
  const reviewTotal = todayReviewQuery.data?.total ?? null;
  const weakAccuracyPct = parsePctString(weaknessTop?.accuracy ?? null);
  const card4 = {
    value: reviewTotal !== null ? String(reviewTotal) : NULL_VALUE,
    unit: '题',
    label: '本阶段累计错题',
    delta: weaknessTop !== null && weakAccuracyPct !== null
      ? { text: `${weaknessTop.subjectLabel} 占 ${weakAccuracyPct}%`, tone: 'warn' as const }
      : undefined,
  };

  return (
    <section className={styles.row} aria-label="本周学习概览" data-testid="home-metric-row">
      <MetricCard
        testId="home-metric-countdown"
        iconId="calendar"
        value={countdown.value}
        label={countdown.label}
        progress={countdown.progress}
      />
      <MetricCard
        testId="home-metric-today"
        iconId="check"
        value={card2.value}
        label={card2.label}
        delta={card2.delta}
      />
      <MetricCard
        testId="home-metric-week"
        iconId="trend"
        value={card3.value}
        unit={card3.unit}
        label={card3.label}
        delta={card3.delta}
      />
      <MetricCard
        testId="home-metric-review"
        iconId="warning"
        iconTone="err"
        value={card4.value}
        unit={card4.unit}
        label={card4.label}
        delta={card4.delta}
      />
    </section>
  );
}
