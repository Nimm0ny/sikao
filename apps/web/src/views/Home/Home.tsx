// lint-allow-ui-copy: V5-M3.5 page skeleton — placeholder copy is stand-in
// for design.md §D.4.1 prose. ui-copy SSOT migration tracked under future
// Phase 6+. Real strings will land via @/lib/ui-copy when business Phase
// integrations replace the placeholders.
import { useEffect } from 'react';
import { Panel, ScreenLockShell, ScrollRegion } from '../../components/layout';
import { useDashboardPreferenceStore, usePlanStore } from '@sikao/domain';
import { CalendarPanel } from './sections/CalendarPanel';
import { HomeTopbar } from './sections/HomeTopbar';
import { MetricRow } from './sections/MetricRow';
import { WeeklyReviewSection } from './sections/WeeklyReviewSection';
import { ProgressSection } from './sections/ProgressSection';
import { RecommendationSection } from './sections/RecommendationSection';
import styles from './Home.module.css';

/*
 * Home view — V5 D.4.1 desktop page skeleton.
 *
 * Why: container tree per design.md §D.4.1 — 4-row Workspace grid
 *      (topbar / metric-row × 4 / Calendar / BottomRow × 3). MetricRow
 *      (SIK-125) wires real /api/v2/dashboard endpoints; CalendarPanel
 *      (SIK-90 W2) owns the today/week/month switching with persisted
 *      preference. The shell here only owns layout + the calendar view
 *      hydration effect.
 */

const CALENDAR_VIEW_KEYS = ['today', 'week', 'month'] as const;

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

      <MetricRow />

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
