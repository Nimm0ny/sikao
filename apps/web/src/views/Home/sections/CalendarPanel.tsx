// lint-allow-ui-copy: V5 D.4.1 Calendar panel head copy. CJK strings are
// visual contract from the V5 prototype (Home v2.1.html panel-head).
import { useCallback, useId } from 'react';
import { useDashboardPreferenceStore, usePlanStore } from '@sikao/domain';
import type { PlanCalendarView } from '@sikao/domain/plan/usePlanStore';

import { Tabs, type TabItem } from '../../../components/nav/Tabs';
import { Button } from '../../../components/form';
import { WeekCalendarView } from './WeekCalendarView';
import { MonthCalendarView } from './MonthCalendarView';
import {
  buildHomeCalendarPreferencePatch,
  toDashboardPreferencesPatch,
  useCalendarViewConfig,
} from './calendarViewConfig';
import type { CalendarViewConfig } from './calendarViewConfig';
import styles from './CalendarPanel.module.css';

const VIEW_KEYS = ['week', 'month'] as const satisfies ReadonlyArray<PlanCalendarView>;

const SEGMENT_ITEMS: ReadonlyArray<TabItem> = [
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
];

function isPlanCalendarView(value: unknown): value is PlanCalendarView {
  return typeof value === 'string' && (VIEW_KEYS as ReadonlyArray<string>).includes(value);
}

function shiftDate(dateStr: string, amount: number): string {
  const day = new Date(`${dateStr}T00:00:00`);
  day.setDate(day.getDate() + amount);
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftCalendarAnchor(view: PlanCalendarView, currentDate: string, direction: -1 | 1): string {
  if (view === 'week') return shiftDate(currentDate, direction * 7);
  return shiftDate(currentDate, direction * 21);
}

function navAriaLabel(view: PlanCalendarView, direction: -1 | 1): string {
  if (view === 'week') return direction < 0 ? '上一周' : '下一周';
  return direction < 0 ? '上 3 周' : '下 3 周';
}

export function CalendarPanel() {
  const headingId = useId();
  const currentView = usePlanStore((state) => state.currentView);
  const currentDate = usePlanStore((state) => state.currentDate);
  const setCurrentView = usePlanStore((state) => state.setCurrentView);
  const setCurrentDate = usePlanStore((state) => state.setCurrentDate);
  const patchPreferences = useDashboardPreferenceStore((state) => state.patchPreferences);
  const viewConfig = useCalendarViewConfig(currentView);

  const handleViewChange = useCallback(
    (nextKey: string): void => {
      if (!isPlanCalendarView(nextKey)) return;
      setCurrentView(nextKey);
      const patch = buildHomeCalendarPreferencePatch({ homeCalendarView: nextKey });
      void patchPreferences(toDashboardPreferencesPatch(patch));
    },
    [patchPreferences, setCurrentView],
  );

  const handlePrev = useCallback(() => {
    setCurrentDate(shiftCalendarAnchor(currentView, currentDate, -1));
  }, [currentDate, currentView, setCurrentDate]);

  const handleNext = useCallback(() => {
    setCurrentDate(shiftCalendarAnchor(currentView, currentDate, 1));
  }, [currentDate, currentView, setCurrentDate]);

  const handleToday = useCallback(() => {
    setCurrentDate(todayStamp());
  }, [setCurrentDate]);

  return (
    <section className={styles.panel} aria-labelledby={headingId} data-testid="home-calendar-panel">
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
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={handlePrev} aria-label={navAriaLabel(currentView, -1)}>
            ◀
          </Button>
          <Button variant="ghost" size="sm" onClick={handleToday} aria-label="回到今天">
            ○
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNext} aria-label={navAriaLabel(currentView, 1)}>
            ▶
          </Button>
          <Button variant="ghost" size="sm" disabled aria-label="新建事件 (Plan 创建落 SIK-FU-N)">
            ＋
          </Button>
        </div>
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
  if (view === 'week') return <WeekCalendarView viewConfig={viewConfig} />;
  return <MonthCalendarView viewConfig={viewConfig} />;
}
