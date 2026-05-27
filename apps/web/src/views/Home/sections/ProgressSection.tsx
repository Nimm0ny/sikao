// lint-allow-ui-copy: V5 D.4.1 Home Section B copy. CJK strings are visual
// contract from `.tmp_review/out/Tab1-Home/Home v2.1.html` 底栏第 2 格.
import { Link } from 'react-router-dom';
import { useProgressOverview } from '@sikao/api-client/progressQueries';
import type { WeaknessItemV2 } from '@sikao/api-client/types/home';
import { Skeleton } from '../../../components/atom';
import { EmptyState } from '../../../components/atom/EmptyState';
import styles from './ProgressSection.module.css';

/*
 * ProgressSection — Home Section B · 学习进度 mini card.
 *
 * Why: bottom row #2 (per V5 prototype `Home v2.1.html` line 1487-1518).
 *      sik-fu-d-progress-recommendation-visual-contract.md §2.1: each
 *      weak-item is a 3-column row: name (90px ellipsis) + bar(track +
 *      fill, err class when accuracy <= 50%) + val (36px tabular-nums
 *      right-align). No Badge — that was a SIK-91 v1 visual drift.
 *
 *      bc-head: "Top 3 弱项" + Link "弱项分析 →" jumping to
 *      /profile/learning (active range = 30 days).
 *
 *      4-state contract (loading / error / empty / ready); error and
 *      empty surface as compact EmptyState because the panel is mini.
 */

const TOP_WEAKNESS_LIMIT = 3;
const ERR_THRESHOLD_PCT = 50;

function parseAccuracyPct(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  // Backend serializes accuracy as a 0..1 decimal string; convert to %.
  return Math.round(num * 1000) / 10;
}

function WeakItem({ item }: { readonly item: WeaknessItemV2 }) {
  const pct = parseAccuracyPct(item.accuracy);
  const widthPct = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const isErr = pct !== null && pct <= ERR_THRESHOLD_PCT;
  return (
    <li className={styles.weakItem} data-testid={`home-progress-weak-${item.subjectKey}`}>
      <span className={styles.weakName} title={item.subjectLabel}>{item.subjectLabel}</span>
      <span className={styles.barTrack} aria-hidden="true">
        <span
          className={styles.barFill}
          data-err={isErr || undefined}
          style={{ width: `${widthPct}%` }}
        />
      </span>
      <span className={styles.weakVal}>
        {pct === null ? '—' : `${pct.toFixed(1)}%`}
      </span>
    </li>
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

  const weakness = (data.weaknessTop3 ?? []).slice(0, TOP_WEAKNESS_LIMIT);

  return (
    <div className={styles.root} data-testid="home-progress">
      <header className={styles.head}>
        <h4 className={styles.title}>Top 3 弱项</h4>
        <Link to="/profile/learning?range=30d" className={styles.headLink}>
          弱项分析 →
        </Link>
      </header>
      {weakness.length > 0 ? (
        <ul className={styles.weakList} data-testid="home-progress-weakness">
          {weakness.map((item) => <WeakItem key={item.subjectKey} item={item} />)}
        </ul>
      ) : (
        <EmptyState title="近期无明显弱项" description="保持节奏，继续练习。" />
      )}
    </div>
  );
}
