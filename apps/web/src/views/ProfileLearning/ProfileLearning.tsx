// lint-allow-ui-copy: V5 ProfileLearning container copy. CJK strings are
// visual contract from `Profile Learning v1.html`.
import { lazy, Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useProgressOverview } from '@sikao/api-client/progressQueries';
import { PageHeader, ScreenLockShell, ScrollRegion } from '../../components/layout';
import { Button } from '../../components/form';
import { Skeleton } from '../../components/atom/Skeleton';
import { EmptyState } from '../../components/atom/EmptyState';
import { SubNav } from '../Me/SubNav';
import { RangeBar, type RangeKey } from './RangeBar';
import { KpiRow } from './KpiRow';
import styles from './ProfileLearning.module.css';

// recharts-backed sections lazy-loaded so the Home route doesn't pay the
// chart bundle cost (sik-fu-b §6 B7).
const WeaknessRadar = lazy(() => import('./Charts').then((m) => ({ default: m.WeaknessRadar })));
const TimeseriesChart = lazy(() => import('./Charts').then((m) => ({ default: m.TimeseriesChart })));

/*
 * ProfileLearning — /profile/learning drilldown.
 *
 * Why: sik-fu-b §1 — 4-row grid via ScreenLockShell:
 *        1. ws-topbar (PageHeader + actions)
 *        2. sub-nav (8 tab pills, active="learning")
 *        3. range-bar (4 seg + date picker + compare)
 *        4. learning-grid (ScrollRegion + KPI row + Trend/Radar + Tree/Heatmap)
 *
 *      4-state contract: loading / error / empty / ready. Errors and
 *      empty states keep sub-nav + range-bar visible per contract §3.
 */

export function ProfileLearning() {
  const [range, setRange] = useState<RangeKey>('30d');
  const query = useProgressOverview();

  return (
    <ScreenLockShell rows="auto auto auto minmax(0, 1fr)" testId="profile-learning">
      <PageHeader
        title="详细学情"
        subtitle="查看你的练习量、正确率与薄弱模块趋势"
        actions={
          <div className={styles.headerActions}>
            <Button variant="ghost" size="sm" disabled aria-label="导出 PDF (占位，待 SIK-FU-N)">
              导出 PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { void query.refetch(); }}
              disabled={query.isFetching}
            >
              刷新
            </Button>
            <Link to="/">
              <Button variant="ghost" size="sm">返回首页</Button>
            </Link>
          </div>
        }
      />
      <SubNav active="learning" />
      <RangeBar active={range} onChange={setRange} />
      <ScrollRegion>
        <Body query={query} range={range} />
      </ScrollRegion>
    </ScreenLockShell>
  );
}

interface BodyProps {
  readonly query: ReturnType<typeof useProgressOverview>;
  readonly range: RangeKey;
}

function Body({ query, range }: BodyProps) {
  if (query.isLoading) {
    return (
      <section className={styles.learningGrid} role="status" aria-label="学情数据加载中" data-testid="profile-learning-loading">
        <Skeleton variant="rect" height={96} />
        <Skeleton variant="rect" height={280} />
        <Skeleton variant="rect" height={280} />
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className={styles.learningGrid} data-testid="profile-learning-error">
        <EmptyState
          title="无法加载学情数据"
          description={String((query.error as Error | null)?.message ?? '稍后重试')}
        />
      </section>
    );
  }

  if (!query.data) {
    return (
      <section className={styles.learningGrid} data-testid="profile-learning-empty">
        <EmptyState title="窗口内无数据" description="请切换时间范围或先完成一次练习。" />
      </section>
    );
  }

  return (
    <section className={styles.learningGrid} data-testid="profile-learning-grid">
      <KpiRow overview={query.data} range={range} />
      <Row2Col ratio="trend"
        left={
          <Suspense fallback={<Skeleton variant="rect" height={280} />}>
            <TimeseriesChart />
          </Suspense>
        }
        right={
          <Suspense fallback={<Skeleton variant="rect" height={280} />}>
            <WeaknessRadar />
          </Suspense>
        }
      />
      {/* KnowledgeTree + Heatmap land in W3. Skeleton placeholder for now. */}
      <Row2Col ratio="tree"
        left={<div className={styles.placeholder} data-testid="profile-learning-tree-placeholder">知识树（W3 落实）</div>}
        right={<div className={styles.placeholder} data-testid="profile-learning-heatmap-placeholder">热力图（W3 落实）</div>}
      />
    </section>
  );
}

function Row2Col({
  left,
  right,
  ratio,
}: {
  readonly left: ReactNode;
  readonly right: ReactNode;
  readonly ratio: 'trend' | 'tree';
}) {
  return (
    <div className={styles.row2col} data-ratio={ratio}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}
