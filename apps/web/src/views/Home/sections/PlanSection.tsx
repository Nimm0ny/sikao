// lint-allow-ui-copy: V5 D.4.1 Section A "学习计划" head copy. CJK strings
// here are visual contract from the V5 prototype (Home v2.1.html plan-head)
// and the Home Phase 04-Frontend-WU §F4.1 spec; will route through ui-copy
// SSOT once a Section-A namespace is registered (Home Phase Closeout).
import { useId, type ReactNode } from 'react';
import { Tabs, type TabItem } from '../../../components/nav/Tabs';
import { useDashboardPreferenceStore, usePlanStore } from '@sikao/domain';
import type { PlanCalendarView } from '@sikao/domain/plan/usePlanStore';
import styles from './PlanSection.module.css';

/*
 * PlanSection — Home D.4.1 Section A "学习计划" container.
 *
 * Why: matches `.tmp_review/out/Tab1-Home/Home v2.1.html` plan-head + body
 *      shell. Owns three responsibilities, none of them fetching data:
 *        1. Calendar view segment (today / week / month). Switch writes to
 *           usePlanStore (transient; calendar bodies subscribe) AND to
 *           useDashboardPreferenceStore (debounced persist via existing
 *           profile-info PUT + localStorage fallback contract).
 *        2. Countdown chip — placeholder copy "国考 D-138" until exam
 *           target store ships in Home M-D. Real value comes from
 *           useDashboardOverview / nearestExamTarget; left as a static
 *           hint here so the visual is in place without coupling Wave 1
 *           to D's data path.
 *        3. Body slot — the calendar canvas. Today/Week/Month bodies are
 *           rendered by the parent based on `currentView` from
 *           usePlanStore so each body owns its own range fetch (per plan
 *           §3.2 落地路径).
 *
 *      Persist contract: `useDashboardPreferenceStore.patchPreferences`
 *      is async; the segment switch fires it without awaiting (state
 *      change is the source of truth, persist is best-effort with the
 *      store's internal localStorage fallback). Errors land on
 *      lastPersistError inside the store and surface elsewhere.
 *
 *      AGENT-H7 fail-fast: parsePersistedView only accepts the literal
 *      'today' | 'week' | 'month' values; any other value falls through
 *      to undefined (caller gets the store-level default 'week'). No
 *      `?? defaultValue` over arbitrary input.
 */

const VIEW_KEYS = ['today', 'week', 'month'] as const satisfies ReadonlyArray<PlanCalendarView>;

const SEGMENT_ITEMS: ReadonlyArray<TabItem> = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
];

const PREF_KEY = 'homeCalendarView';

function isPlanCalendarView(value: unknown): value is PlanCalendarView {
  return typeof value === 'string' && (VIEW_KEYS as ReadonlyArray<string>).includes(value);
}

export interface PlanSectionProps {
  readonly children?: ReactNode;
  /**
   * Optional override for the countdown chip. When omitted the placeholder
   * "国考 D-138" lands; real wiring comes from
   * useDashboardOverview.nearestExamTarget in Home M-D.
   */
  readonly countdown?: { readonly label: string; readonly daysUntil: number };
}

export function PlanSection({ children, countdown }: PlanSectionProps) {
  const headingId = useId();
  const currentView = usePlanStore((s) => s.currentView);
  const setCurrentView = usePlanStore((s) => s.setCurrentView);
  const persistedView = useDashboardPreferenceStore((s) => {
    const value = s.preferences?.[PREF_KEY];
    return isPlanCalendarView(value) ? value : null;
  });
  const patchPreferences = useDashboardPreferenceStore((s) => s.patchPreferences);

  // Source of truth: the persisted preference (if known) overrides the
  // store default 'week'. We don't push the persisted value back into the
  // store on render — the parent view bootstraps usePlanStore from the
  // preference store on mount via setCurrentView (handled in Home.tsx).
  const activeView: PlanCalendarView = persistedView ?? currentView;

  function handleChange(nextKey: string): void {
    if (!isPlanCalendarView(nextKey)) return;
    setCurrentView(nextKey);
    void patchPreferences({ [PREF_KEY]: nextKey });
  }

  const cd = countdown ?? { label: '国考', daysUntil: 138 };

  return (
    <section
      className={styles.root}
      aria-labelledby={headingId}
      data-testid="home-plan-section"
    >
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <h2 id={headingId} className={styles.title}>学习计划</h2>
          <span className={styles.meta}>选择视图查看今日 / 本周 / 本月计划事件</span>
        </div>
        <div className={styles.segment}>
          <Tabs
            variant="segmented"
            size="sm"
            items={SEGMENT_ITEMS}
            active={activeView}
            onChange={handleChange}
            noPanel
            aria-label="日历视图切换"
          />
        </div>
        <span
          className={styles.countdown}
          aria-label={`${cd.label}倒计时`}
          title={cd.label}
          data-testid="home-plan-countdown"
        >
          {cd.label} D-<b className={styles.countdownNumber}>{cd.daysUntil}</b>
        </span>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
