// lint-allow-ui-copy: V5-M3.5 page skeleton — placeholder copy is stand-in
// for design.md §D.4.1 prose. ui-copy SSOT migration tracked under future
// Phase 6+. Real strings will land via @/lib/ui-copy when business Phase
// integrations replace the placeholders.
import { useEffect } from 'react';
import { Numeric } from '../../components/atom';
import { Panel, ScreenLockShell, ScrollRegion } from '../../components/layout';
import { useDashboardPreferenceStore, usePlanStore } from '@sikao/domain';
import { CalendarPanel } from './sections/CalendarPanel';
import { HomeTopbar } from './sections/HomeTopbar';
import { WeeklyReviewSection } from './sections/WeeklyReviewSection';
import { ProgressSection } from './sections/ProgressSection';
import { RecommendationSection } from './sections/RecommendationSection';
import styles from './Home.module.css';

/*
 * Home view — V5 D.4.1 desktop page skeleton.
 *
 * Why: container tree per design.md §D.4.1 — 4-row Workspace grid
 *      (topbar / metric-row × 4 / Calendar / BottomRow × 3). Renders
 *      placeholder data only; the real metrics + calendar engine wire-up
 *      ships with each business Phase (Home Phase SIK-29 already owns
 *      its own runtime track via api/v2 endpoints, but this skeleton is
 *      the V5 visual contract for that integration to land into).
 *
 *      Fail-fast: throws on negative metric values (defensive guard while
 *      placeholder data is in play; remove once the API client lands).
 */

interface HomeMetric {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit?: string;
  readonly delta?: { readonly direction: 'up' | 'down' | 'flat'; readonly text: string };
}

const PLACEHOLDER_METRICS: ReadonlyArray<HomeMetric> = [
  { key: 'practice', label: '本周练习', value: 128, unit: '题', delta: { direction: 'up', text: '+12 vs 上周' } },
  { key: 'accuracy', label: '正确率', value: 76.4, unit: '%', delta: { direction: 'up', text: '+2.1 pp' } },
  { key: 'duration', label: '学习时长', value: 4.5, unit: '小时', delta: { direction: 'flat', text: '与上周持平' } },
  { key: 'rank', label: '同省排名', value: 132, delta: { direction: 'down', text: '下滑 8 位' } },
];

const CALENDAR_VIEW_KEYS = ['today', 'week', 'month'] as const;

function MetricCard({ metric }: { readonly metric: HomeMetric }) {
  if (!Number.isFinite(metric.value) || metric.value < 0) {
    throw new Error(`Home metric "${metric.key}" must be a non-negative finite number, got ${metric.value}`);
  }
  return (
    <article className={styles.metricCard} data-testid={`home-metric-${metric.key}`}>
      <span className={styles.metricLabel}>{metric.label}</span>
      <Numeric value={metric.value} unit={metric.unit} size="h2" emphasis="value" />
      {metric.delta !== undefined ? (
        <span className={styles.metricDelta} data-direction={metric.delta.direction}>
          {metric.delta.text}
        </span>
      ) : null}
    </article>
  );
}

export function Home() {
  // SIK-90 Wave 2 (2026-05-25): hydrate persisted calendar view from
  // useDashboardPreferenceStore into usePlanStore once on mount so the
  // CalendarPanel renders the right view without flashing the store
  // default. CalendarPanel itself owns the user-driven view changes.
  useEffect(() => {
    const persisted =
      useDashboardPreferenceStore.getState().preferences?.['homeCalendarView'];
    if (typeof persisted === 'string' && (CALENDAR_VIEW_KEYS as ReadonlyArray<string>).includes(persisted)) {
      usePlanStore.getState().setCurrentView(persisted as typeof CALENDAR_VIEW_KEYS[number]);
    }
  }, []);

  return (
    <ScreenLockShell rows="auto auto minmax(0, 1.6fr) minmax(0, 1fr)" testId="home-view">
      <HomeTopbar />

      <section className={styles.metricRow} aria-label="本周学习概览">
        {PLACEHOLDER_METRICS.map((m) => <MetricCard key={m.key} metric={m} />)}
      </section>

      <ScrollRegion>
        <CalendarPanel />
      </ScrollRegion>

      <section className={styles.bottomRow} aria-label="底部模块">
        <Panel title="本周备考回顾">
          <WeeklyReviewSection />
        </Panel>

        <Panel title="学习进度">
          <ProgressSection />
        </Panel>

        <Panel title="今日推荐">
          <RecommendationSection />
        </Panel>
      </section>
    </ScreenLockShell>
  );
}
