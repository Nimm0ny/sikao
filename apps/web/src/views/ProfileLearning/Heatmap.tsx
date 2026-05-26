// lint-allow-ui-copy: V5 ProfileLearning Heatmap copy. CJK strings are
// visual contract from Profile Learning v1.html lines 115+.
import { useMemo } from 'react';
import { useProgressTimeseries } from '@sikao/api-client/progressQueries';
import { Panel } from '../../components/layout';
import { Skeleton } from '../../components/atom/Skeleton';
import { EmptyState } from '../../components/atom/EmptyState';
import styles from './Heatmap.module.css';

/*
 * Heatmap — ProfileLearning study-time heatmap (60px time labels + 7 cols).
 *
 * Why: sik-fu-b §2.5 — 60px time-of-day label column + 7 day-of-week
 *      columns; 4-level intensity via data-l = 0/1/2/3. Drift §5: data-l=3
 *      uses --color-text-primary (black on yellow) instead of white,
 *      because white-on-yellow fails axe AA.
 *
 *      Data: useProgressTimeseries('day' granularity); we distribute each
 *      day's items evenly across 3 time bands (上午/下午/晚上) until the
 *      backend exposes hourly granularity (known data gap).
 *
 *      AGENT-H7: count == 0 -> data-l=0; counts thresholded into 1/2/3
 *      relative to the max non-zero bucket. No fabricated data when
 *      query is empty.
 */

const TIME_BANDS = [
  { key: 'morning',   label: '上午' },
  { key: 'afternoon', label: '下午' },
  { key: 'evening',   label: '晚上' },
] as const;
const DOW_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;
const RANGE_DAYS = 28;

function pad(n: number) { return String(n).padStart(2, '0'); }
function dateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dowIndex(stamp: string): number {
  const d = new Date(`${stamp}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

function intensityLevel(count: number, max: number): 0 | 1 | 2 | 3 {
  if (count === 0 || max === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.33) return 1;
  if (ratio <= 0.66) return 2;
  return 3;
}

export function Heatmap() {
  const query = useProgressTimeseries({
    from: dateOffset(RANGE_DAYS - 1),
    to: dateOffset(0),
    granularity: 'day',
  });

  const { cellsByBand, max, busiestDow } = useMemo(() => {
    const points = query.data?.points ?? [];
    const map = new Map<string, number>();
    const dowTotals = new Array(7).fill(0) as number[];
    for (const p of points) {
      const stamp = p.bucketStart.slice(0, 10);
      const dow = dowIndex(stamp);
      dowTotals[dow] = (dowTotals[dow] ?? 0) + p.itemsAnswered;
      const perBand = Math.round(p.itemsAnswered / TIME_BANDS.length);
      for (const band of TIME_BANDS) {
        const key = `${band.key}-${dow}`;
        map.set(key, (map.get(key) ?? 0) + perBand);
      }
    }
    const cellsByBand = new Map<string, ReadonlyArray<number>>();
    for (const band of TIME_BANDS) {
      const row: number[] = [];
      for (let dow = 0; dow < 7; dow++) {
        row.push(map.get(`${band.key}-${dow}`) ?? 0);
      }
      cellsByBand.set(band.key, row);
    }
    let max = 0;
    for (const row of cellsByBand.values()) {
      for (const v of row) if (v > max) max = v;
    }
    const busiestDow = dowTotals.reduce(
      (best, total, idx) => (total > best.total ? { idx, total } : best),
      { idx: -1, total: -1 },
    ).idx;
    return { cellsByBand, max, busiestDow };
  }, [query.data]);

  if (query.isLoading) {
    return (
      <Panel title="学习时段热力图">
        <Skeleton variant="rect" height={240} />
      </Panel>
    );
  }

  if ((query.data?.points ?? []).length === 0) {
    return (
      <Panel title="学习时段热力图">
        <EmptyState title="窗口内尚无学习记录" description="完成一次练习后这里会出现热力图。" />
      </Panel>
    );
  }

  return (
    <Panel title="学习时段热力图">
      <div className={styles.root} data-testid="profile-learning-heatmap">
        <div className={styles.headerRow} aria-hidden="true">
          <span className={styles.timeLabel} />
          {DOW_LABELS.map((label) => (
            <span key={label} className={styles.dowLabel}>周{label}</span>
          ))}
        </div>
        {TIME_BANDS.map((band) => {
          const row = cellsByBand.get(band.key) ?? [];
          return (
            <div key={band.key} className={styles.bandRow}>
              <span className={styles.timeLabel}>{band.label}</span>
              {DOW_LABELS.map((dowLabel, dow) => {
                const count = row[dow] ?? 0;
                const level = intensityLevel(count, max);
                return (
                  <span
                    key={dow}
                    className={styles.cell}
                    data-l={level}
                    aria-label={`周${dowLabel} ${band.label} ${count} 题`}
                    title={`周${dowLabel} ${band.label}: ${count} 题`}
                  >
                    {count > 0 ? count : ''}
                  </span>
                );
              })}
            </div>
          );
        })}
        {busiestDow >= 0 ? (
          <p className={styles.observation} data-testid="profile-learning-heatmap-observation">
            观察：你在<b>周{DOW_LABELS[busiestDow]}</b>练得最多，可适当向其他时段分配。
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
