// lint-allow-ui-copy: V5 D.4.1 Home Section B copy. CJK strings are visual
// contract from `.tmp_review/out/Tab1-Home/Home v2.1.html` 底栏第 2 格.
import { Link } from 'react-router-dom';
import { useProgressOverview } from '@sikao/api-client/progressQueries';
import type { WeaknessItemV2 } from '@sikao/api-client/types/home';
import { Numeric, Skeleton, Badge } from '../../../components/atom';
import { EmptyState } from '../../../components/atom/EmptyState';
import { Button } from '../../../components/form';
import styles from './ProgressSection.module.css';

/*
 * ProgressSection — Home Section B · 学习进度 mini card.
 *
 * Why: bottom row #2 (per V5 prototype `Home v2.1.html`). Surfaces the
 *      week-window key metric + top3 weakness list with a CTA jumping
 *      to the /profile/learning drilldown (SIK-91 wave 2/3 scope).
 *
 *      4-state contract:
 *        loading → Skeleton stack
 *        error   → EmptyState (description carries the error message;
 *                  the panel is mini so a full ErrorCard would dominate)
 *        empty   → EmptyState ("尚无学习进度数据")
 *        ready   → metric row + weakness list + CTA
 *
 *      Charts are deliberately not rendered here — recharts lazy-loaded
 *      on the drilldown route per plan §3.3 acceptance.
 */

const TOP_WEAKNESS_LIMIT = 3;

function parseAccuracy(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  // Backend serializes accuracy as a 0..1 decimal string; convert to %.
  return Math.round(num * 1000) / 10;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function severityVariant(severity: string): 'err' | 'warn' | 'ok' {
  if (severity === 'high') return 'err';
  if (severity === 'medium') return 'warn';
  return 'ok';
}

function WeaknessList({ items }: { readonly items: ReadonlyArray<WeaknessItemV2> }) {
  return (
    <>
      <p className={styles.weaknessHeader}>薄弱模块（前 3）</p>
      <ul className={styles.weaknessList} data-testid="home-progress-weakness">
        {items.map((item) => {
          const accuracyPct = parseAccuracy(item.accuracy);
          return (
            <li key={item.subjectKey} className={styles.weaknessItem}>
              <div>
                <Badge variant={severityVariant(item.severity)} size="sm">
                  {item.subjectLabel}
                </Badge>
              </div>
              <span className={styles.weaknessAccuracy}>
                正确率 {formatPercent(accuracyPct)}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function ProgressSection() {
  const query = useProgressOverview();

  if (query.isLoading) {
    return (
      <div className={styles.root} role="status" aria-label="学习进度加载中" data-testid="home-progress-loading">
        <Skeleton variant="rect" height={32} />
        <Skeleton variant="text" lines={3} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div data-testid="home-progress-error">
        <EmptyState
          title="无法加载学习进度"
          description={String((query.error as Error | null)?.message ?? 'Network error')}
        />
      </div>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <div data-testid="home-progress-empty">
        <EmptyState title="尚无学习进度数据" description="完成一次练习后这里会出现统计。" />
      </div>
    );
  }

  const weekItemsAnswered = data.summary.week.itemsAnswered;
  const weekAccuracy = parseAccuracy(data.summary.week.accuracy);
  const weakness = (data.weaknessTop3 ?? []).slice(0, TOP_WEAKNESS_LIMIT);

  return (
    <div className={styles.root} data-testid="home-progress">
      <div className={styles.metricRow}>
        <Numeric value={weekItemsAnswered} unit="题" size="h2" emphasis="value" />
        <span className={styles.metricKey}>本周练习量 · 正确率 {formatPercent(weekAccuracy)}</span>
      </div>
      {weakness.length > 0 ? <WeaknessList items={weakness} /> : null}
      <Link to="/profile/learning" className={styles.cta}>
        <Button variant="secondary" size="sm">查看学习详情</Button>
      </Link>
    </div>
  );
}
