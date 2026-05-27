// lint-allow-ui-copy: V5 ProfileLearning KPI row copy. CJK strings are
// visual contract from `Profile Learning v1.html` lines 41-50.
import type { DashboardProgressResponseV2 } from '@sikao/api-client/types/home';
import type { RangeKey } from './RangeBar';
import { Numeric } from '../../components/atom';
import styles from './KpiRow.module.css';

/*
 * KpiRow — ProfileLearning 5-cell KPI row.
 *
 * Why: sik-fu-b §2.4 — 5 cells render in a fixed grid order:
 *        1. 练习题数 (itemsAnswered)
 *        2. 学习时长 (durationHours)
 *        3. 行测正确率 (xingceAccuracy)
 *        4. 申论均分 (shenlunAverage)
 *        5. 连续打卡 (streakDays)
 *
 *      W1 lands the visual skeleton wired to the V2 schema fields that
 *      already exist (allTime / week buckets); fields not yet in the API
 *      surface (xingceAccuracy / shenlunAverage / streakDays) render
 *      as '—' until the backend ships them. delta indicators are flat
 *      placeholders (no compare-to-prev support without timeseries diff).
 */

interface KpiCell {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly delta: { readonly direction: 'up' | 'down' | 'flat'; readonly text: string };
}

function parseAccuracyPct(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 1000) / 10;
}

function pickBucket(overview: DashboardProgressResponseV2, range: RangeKey) {
  // Map the contract range to the ProgressMetricBucketV2 the API emits.
  // 'week' / '30d' / '90d' / 'all' all collapse to the available buckets:
  // week -> summary.week, 30d/90d -> summary.allTime (timeseries diff
  // shipping later), all -> summary.allTime.
  if (range === 'week') return overview.summary.week;
  return overview.summary.allTime;
}

function buildCells(overview: DashboardProgressResponseV2, range: RangeKey): ReadonlyArray<KpiCell> {
  const bucket = pickBucket(overview, range);
  const accuracyPct = parseAccuracyPct(bucket.accuracy);
  const hours = (bucket.minutesPracticed / 60).toFixed(1);
  // Delta direction is flat across all cells until the timeseries diff
  // lands; AGENT-H7 prevents fabricating up/down without ground truth.
  const flat = { direction: 'flat' as const, text: '—' };
  return [
    { key: 'practice',  label: '练习题数',   value: String(bucket.itemsAnswered),                            unit: '题',  delta: flat },
    { key: 'duration',  label: '学习时长',   value: hours,                                                    unit: 'h',   delta: flat },
    { key: 'xingce',    label: '行测正确率', value: accuracyPct === null ? '—' : accuracyPct.toFixed(1),     unit: '%',   delta: flat },
    { key: 'shenlun',   label: '申论均分',   value: '—',                                                      unit: '/50', delta: flat },
    { key: 'streak',    label: '连续打卡',   value: '—',                                                      unit: '天',  delta: flat },
  ];
}

export interface KpiRowProps {
  readonly overview: DashboardProgressResponseV2;
  readonly range: RangeKey;
}

export function KpiRow({ overview, range }: KpiRowProps) {
  const cells = buildCells(overview, range);
  return (
    <ul className={styles.row} aria-label="关键指标" data-testid="profile-learning-kpi-row" role="list">
      {cells.map((cell) => (
        <li key={cell.key} className={styles.cell} data-testid={`kpi-cell-${cell.key}`}>
          <span className={styles.label}>{cell.label}</span>
          <Numeric value={cell.value} unit={cell.unit} size="h2" emphasis="value" />
          <span className={styles.delta} data-direction={cell.delta.direction}>
            {cell.delta.direction === 'up'   ? '▲ ' : null}
            {cell.delta.direction === 'down' ? '▼ ' : null}
            {cell.delta.direction === 'flat' ? '→ ' : null}
            {cell.delta.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
