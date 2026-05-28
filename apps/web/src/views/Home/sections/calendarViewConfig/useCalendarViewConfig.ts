/*
 * calendarViewConfig/useCalendarViewConfig.ts — SIK-138 W4.
 *
 * Why: requirements.md Requirement 1 + design.md "State and Data Flow" lock
 *      `CalendarPanel` as the single resolver of `CalendarViewConfig`. The
 *      hook centralizes that resolve so the panel stays declarative and
 *      child views never reach into the preference store directly.
 *
 *      Resolution rule:
 *        - while `profileLoaded === false`, return the factory default for
 *          the requested view (visuals match prior behavior; no flash of
 *          partially-hydrated config)
 *        - once profile data has landed, read the persisted knobs via the
 *          W3 readers; missing entries leave the factory default in place
 *
 *      AGENT-H7 note: passing `null` (W3 reader's "no usable value")
 *      through `?? undefined` into `createCalendarViewConfig` is *not* a
 *      silent fallback to a hand-rolled default. The factory itself is the
 *      single truth source for default values; converting `null -> undefined`
 *      is just the contract bridge between "missing in storage" and
 *      "field omitted from override input".
 *
 *      AGENT-H6 / D18: this hook does not introduce a new hydration
 *      mechanism. It reads `profileLoaded` from the existing dashboard
 *      preference store and trusts that signal as-is.
 */

import { useMemo } from 'react';

import { useDashboardPreferenceStore } from '@sikao/domain';

import { createCalendarViewConfig, createDefaultCalendarViewConfig } from './factory';
import { readCardLimitPerCell, readStartWeekOnMonday } from './preferenceKeys';
import type { CalendarView, CalendarViewConfig } from './types';

/**
 * Resolve the active `CalendarViewConfig` for the supplied view. The
 * returned config is memoized on `(view, profileLoaded, preferences)` so
 * `<TodayCalendarView />`, `<WeekCalendarView />`, and
 * `<MonthCalendarView />` only re-render when their effective config
 * actually changes.
 */
export function useCalendarViewConfig(view: CalendarView): CalendarViewConfig {
  const preferences = useDashboardPreferenceStore((s) => s.preferences);
  const profileLoaded = useDashboardPreferenceStore((s) => s.profileLoaded);

  return useMemo(() => {
    if (!profileLoaded) {
      return createDefaultCalendarViewConfig(view);
    }
    const startWeekOnMonday = readStartWeekOnMonday(preferences);
    const cardLimitPerCell = readCardLimitPerCell(preferences);
    return createCalendarViewConfig({
      view,
      startWeekOnMonday: startWeekOnMonday ?? undefined,
      cardLimitPerCell: cardLimitPerCell ?? undefined,
    });
  }, [view, profileLoaded, preferences]);
}
