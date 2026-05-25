// lint-allow-ui-copy: V5 ProfileLearning container copy.
import { lazy, Suspense } from 'react';
import { useProgressOverview } from '@sikao/api-client/progressQueries';
import { Skeleton } from '../../components/atom/Skeleton';
import { EmptyState } from '../../components/atom/EmptyState';
import { ScreenLockShell, ScrollRegion } from '../../components/layout';
import { Header } from './Header';
import { PlanSlice } from './PlanSlice';
import { DiagnosisReport } from './DiagnosisReport';
import styles from './ProfileLearning.module.css';

// recharts is lazy-loaded so the Home route doesn't pay the bundle cost
// (per plan §3.3 acceptance: "recharts 仅在 /profile/learning 路由触发
// 时下载").
const WeaknessRadar = lazy(() => import('./Charts').then((m) => ({ default: m.WeaknessRadar })));
const TimeseriesChart = lazy(() => import('./Charts').then((m) => ({ default: m.TimeseriesChart })));

/*
 * ProfileLearning — /profile/learning drilldown root.
 *
 * Why: plan §3.3 落地路径 — Header + PlanSlice (wave 2) + DiagnosisReport
 *      / WeaknessRadar / TimeseriesChart (wave 3, recharts lazy import
 *      keeps the chunk out of the Home route). Wave 2 lays the
 *      container + the two non-chart sections so the drilldown is
 *      reachable; wave 3 adds the chart sections.
 *
 *      Same 4-state contract as Home Section B (loading / error /
 *      empty / ready) but applied at the container level — children
 *      assume `overview` is defined.
 */

export function ProfileLearning() {
  const query = useProgressOverview();

  if (query.isLoading) {
    return (
      <ScreenLockShell rows="auto minmax(0, 1fr)" testId="profile-learning-loading">
        <div className={styles.stateWrap} role="status" aria-label="学习详情加载中">
          <Skeleton variant="rect" height={64} />
          <Skeleton variant="rect" height={120} />
          <Skeleton variant="text" lines={3} />
        </div>
      </ScreenLockShell>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ScreenLockShell rows="auto minmax(0, 1fr)" testId="profile-learning-error">
        <Header overview={undefined} />
        <div className={styles.stateWrap}>
          <EmptyState
            title="无法加载学习详情"
            description={String((query.error as Error | null)?.message ?? 'Network error')}
          />
        </div>
      </ScreenLockShell>
    );
  }

  return (
    <ScreenLockShell rows="auto minmax(0, 1fr)" testId="profile-learning">
      <Header overview={query.data} />
      <ScrollRegion>
        <div className={styles.sectionGrid}>
          <PlanSlice overview={query.data} />
          <DiagnosisReport />
          <Suspense fallback={<Skeleton variant="rect" height={240} />}>
            <WeaknessRadar />
          </Suspense>
          <Suspense fallback={<Skeleton variant="rect" height={240} />}>
            <TimeseriesChart />
          </Suspense>
        </div>
      </ScrollRegion>
    </ScreenLockShell>
  );
}
