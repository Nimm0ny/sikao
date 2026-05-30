// lint-allow-ui-copy: V5-M3.5 page skeleton — placeholder copy is stand-in
// for design.md §D.4.1 prose. ui-copy SSOT migration tracked under future
// Phase 6+. Real strings will land via @/lib/ui-copy when business Phase
// integrations replace the placeholders.
import { useEffect } from 'react';
import { ScreenLockShell, ScrollRegion } from '../../components/layout';
import { useDashboardPreferenceStore, usePlanStore } from '@sikao/domain';
import { CalendarPanel } from './sections/CalendarPanel';
import { readHomeCalendarView } from './sections/calendarViewConfig';
import { HomeTopbar } from './sections/HomeTopbar';
import { MetricRow } from './sections/MetricRow';
import { WeeklyReviewSection } from './sections/WeeklyReviewSection';
import { ProgressSection } from './sections/ProgressSection';
import { RecommendationSection } from './sections/RecommendationSection';
import { RecentPracticeSection } from './sections/RecentPracticeSection';
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

export function Home() {
  const preferences = useDashboardPreferenceStore((state) => state.preferences);
  const profileLoaded = useDashboardPreferenceStore((state) => state.profileLoaded);
  const hydrateFromLocalFallback = useDashboardPreferenceStore((state) => state.hydrateFromLocalFallback);

  useEffect(() => {
    hydrateFromLocalFallback();
  }, [hydrateFromLocalFallback]);

  // Hydrate / normalize persisted calendar view whenever the dashboard
  // preference store changes. This explicitly covers both delayed profile
  // bootstrap and legacy localStorage fallback instead of reading once on
  // mount and silently ignoring later preference arrival.
  useEffect(() => {
    void profileLoaded;
    const persisted = readHomeCalendarView(preferences);
    if (persisted !== null) {
      usePlanStore.getState().setCurrentView(persisted);
    }
  }, [preferences, profileLoaded]);

  return (
    <ScreenLockShell rows="auto auto minmax(0, 1.6fr) minmax(0, 1fr)" testId="home-view">
      <HomeTopbar />

      <MetricRow />

      <ScrollRegion>
        <CalendarPanel />
      </ScrollRegion>

      <section className={styles.bottomRow} aria-label="底部模块">
        <section className={styles.bottomCard} data-testid="panel" aria-label="今日推荐">
          <RecommendationSection />
        </section>

        <section className={styles.bottomCard} data-testid="panel" aria-label="学习进度">
          <ProgressSection />
        </section>

        <div className={styles.rightStack}>
          <section className={styles.bottomCard} data-testid="panel" aria-label="本周备考回顾">
            <WeeklyReviewSection />
          </section>
          <section className={styles.bottomCard} data-testid="panel" aria-label="最近练习">
            <RecentPracticeSection />
          </section>
        </div>
      </section>
    </ScreenLockShell>
  );
}
