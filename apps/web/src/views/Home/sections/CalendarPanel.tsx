// lint-allow-ui-copy: V5 D.4.1 Calendar panel head copy. CJK strings are
// visual contract from the V5 prototype (Home v2.1.html panel-head) and
// sik-fu-a-home-visual-contract.md §2.3.
import { useCallback, useId } from 'react';
import { Tabs, type TabItem } from '../../../components/nav/Tabs';
import { Button } from '../../../components/form';
import { useDashboardPreferenceStore, usePlanStore } from '@sikao/domain';
import type { PlanCalendarView } from '@sikao/domain/plan/usePlanStore';
import { TodayCalendarView } from './TodayCalendarView';
import { WeekCalendarView } from './WeekCalendarView';
import { MonthCalendarView } from './MonthCalendarView';
import {
  buildHomeCalendarPreferencePatch,
  toDashboardPreferencesPatch,
  useCalendarViewConfig,
} from './calendarViewConfig';
import type { CalendarViewConfig } from './calendarViewConfig';
import styles from './CalendarPanel.module.css';

/*
 * CalendarPanel — Home Section A · single-panel Calendar.
 *
 * Why: sik-fu-a-home-visual-contract.md §1.3 — merges the old PlanSection
 *      + Today/Week/Month CalendarView double-head into a single Panel
 *      with unified head: left panel-tabs + right panel-actions (4 buttons)
 *      + countdown chip.
 *
 *      Responsibilities:
 *        1. View segment (today / week / month) — writes usePlanStore +
 *           persists via useDashboardPreferenceStore using the W3
 *           buildHomeCalendarPreferencePatch (Requirement 7).
 *        2. Anchor navigation (prev / today / next) — shifts the anchor
 *           date in usePlanStore; calendar bodies subscribe.
 *        3. +new button — disabled placeholder (SIK-FU-N).
 *        4. Countdown chip — static placeholder until exam target store.
 *        5. CalendarViewConfig — resolved via useCalendarViewConfig and
 *           passed to today / week / month views as a prop. Per
 *           Requirement 1, child views must not read the store directly.
 *
 *      AGENT-H7: no fallback defaults. `rows` prop is required by
 *      ScreenLockShell; view must be one of the literal union; preference
 *      writes go through the W3 builder which fail-fasts on bad input.
 */

const VIEW_KEYS = ['today', 'week', 'month'] as const satisfies ReadonlyArray<PlanCalendarView>;

const SEGMENT_ITEMS: ReadonlyArray<TabItem> = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
];

function isPlanCalendarView(value: unknown): value is PlanCalendarView {
  return typeof value === 'string' && (VIEW_KEYS as ReadonlyArray<string>).includes(value);
}

export interface CalendarPanelProps {
  /** Countdown chip override. Defaults to placeholder. */
  readonly countdown?: { readonly label: string; readonly daysUntil: number };
}

function shiftDate(dateStr: string, amount: number, unit: 'day' | 'month'): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (unit === 'day') {
    d.setDate(d.getDate() + amount);
  } else {
    d.setMonth(d.getMonth() + amount);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function CalendarPanel({ countdown }: CalendarPanelProps) {
  const headingId = useId();
  const currentView = usePlanStore((s) => s.currentView);
  const currentDate = usePlanStore((s) => s.currentDate);
  const setCurrentView = usePlanStore((s) => s.setCurrentView);
  const setCurrentDate = usePlanStore((s) => s.setCurrentDate);
  const patchPreferences = useDashboardPreferenceStore((s) => s.patchPreferences);
  const viewConfig = useCalendarViewConfig(currentView);

  const handleViewChange = useCallback((nextKey: string): void => {
    if (!isPlanCalendarView(nextKey)) return;
    setCurrentView(nextKey);
    const patch = buildHomeCalendarPreferencePatch({ homeCalendarView: nextKey });
    void patchPreferences(toDashboardPreferencesPatch(patch));
  }, [setCurrentView, patchPreferences]);

  const handlePrev = useCallback(() => {
    if (currentView === 'today') setCurrentDate(shiftDate(currentDate, -1, 'day'));
    else if (currentView === 'week') setCurrentDate(shiftDate(currentDate, -7, 'day'));
    else setCurrentDate(shiftDate(currentDate, -1, 'month'));
  }, [currentView, currentDate, setCurrentDate]);

  const handleNext = useCallback(() => {
    if (currentView === 'today') setCurrentDate(shiftDate(currentDate, 1, 'day'));
    else if (currentView === 'week') setCurrentDate(shiftDate(currentDate, 7, 'day'));
    else setCurrentDate(shiftDate(currentDate, 1, 'month'));
  }, [currentView, currentDate, setCurrentDate]);

  const handleToday = useCallback(() => {
    setCurrentDate(todayStamp());
  }, [setCurrentDate]);

  const cd = countdown ?? { label: '国考', daysUntil: 138 };

  const panelActions = (
    <div className={styles.actions}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePrev}
        aria-label={currentView === 'today' ? '上一日' : currentView === 'week' ? '上一周' : '上一月'}
      >
        ◀
      </Button>
      <Button variant="ghost" size="sm" onClick={handleToday} aria-label="回到今天">
        ○
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleNext}
        aria-label={currentView === 'today' ? '下一日' : currentView === 'week' ? '下一周' : '下一月'}
      >
        ▶
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled
        aria-label="新建事件 (Plan 创建落 SIK-FU-N)"
      >
        ＋
      </Button>
      <span
        className={styles.countdown}
        aria-label={`${cd.label}倒计时`}
        data-testid="home-calendar-countdown"
      >
        {cd.label} D-<b className={styles.countdownNum}>{cd.daysUntil}</b>
      </span>
    </div>
  );

  return (
    <section
      className={styles.panel}
      aria-labelledby={headingId}
      data-testid="home-calendar-panel"
    >
      <header className={styles.head}>
        <Tabs
          variant="segmented"
          size="sm"
          items={SEGMENT_ITEMS}
          active={currentView}
          onChange={handleViewChange}
          noPanel
          aria-label="日历视图切换"
        />
        {panelActions}
      </header>
      <div className={styles.body}>
        <CalendarBody view={currentView} viewConfig={viewConfig} />
      </div>
    </section>
  );
}

function CalendarBody({
  view,
  viewConfig,
}: {
  readonly view: PlanCalendarView;
  readonly viewConfig: CalendarViewConfig;
}) {
  if (view === 'today') return <TodayCalendarView viewConfig={viewConfig} />;
  if (view === 'week') return <WeekCalendarView viewConfig={viewConfig} />;
  return <MonthCalendarView viewConfig={viewConfig} />;
}
