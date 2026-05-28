/*
 * calendarViewConfig — SIK-138 W2 barrel.
 *
 * Why: keep imports tidy across `CalendarPanel.tsx` and the three view
 *      modules; downstream code should always import from the directory,
 *      never reach into a specific submodule.
 */

export type {
  CalendarCardProperty,
  CalendarDensityPreset,
  CalendarView,
  CalendarViewConfig,
  CalendarViewConfigInput,
} from './types';

export {
  InvalidCalendarLimitError,
  InvalidCalendarViewError,
  UnknownCalendarPresetError,
  UnknownCalendarPropertyError,
} from './errors';

export {
  CALENDAR_CARD_PROPERTIES,
  assertCalendarCardProperty,
  isCalendarCardProperty,
} from './propertyRegistry';

export {
  createCalendarViewConfig,
  createCalendarViewConfigPreset,
  createDefaultCalendarViewConfig,
} from './factory';

export type {
  HomeCalendarPreferenceKey,
  HomeCalendarPreferencePatch,
} from './preferenceKeys';

export {
  HOME_CALENDAR_PREFERENCE_KEYS,
  buildHomeCalendarPreferencePatch,
  readCardLimitPerCell,
  readHomeCalendarView,
  readStartWeekOnMonday,
  toDashboardPreferencesPatch,
} from './preferenceKeys';

export { useCalendarViewConfig } from './useCalendarViewConfig';
