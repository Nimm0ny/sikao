/*
 * calendarViewConfig/preferenceKeys.ts — SIK-138 W3.
 *
 * Why: requirements.md Requirement 7 + design.md "CalendarPanel · persists
 *      only" lock the three persisted knobs (`homeCalendarView`,
 *      `startWeekOnMonday`, `cardLimitPerCell`). The store schema is
 *      `dashboardPreferences: {[key: string]: unknown}`, so type narrowing
 *      lives at the read site rather than in the store. W3 ships:
 *
 *        - the canonical key tuple
 *        - typed readers that narrow `unknown` -> the locked types
 *        - a fail-fast write builder that pipes user input through the
 *          W2 factory errors before patching the store
 *
 *      AGENT-H7 note on `null` returns: the readers return `null` for
 *      missing or malformed entries, which is *not* a silent fallback to a
 *      default value. Callers (W4 panel wiring) decide whether to fall
 *      back to `createDefaultCalendarViewConfig(view)` or surface a
 *      banner. Treat `null` as "no usable persisted value" rather than
 *      "value is implicitly OK".
 *
 *      AGENT-H6 (Define-First): adding any new persisted key requires a
 *      spec amendment plus a new entry here; the registry below is the
 *      runtime gate.
 */

import type { CalendarCardProperty, CalendarView } from './types';
import {
  InvalidCalendarLimitError,
  InvalidCalendarViewError,
  UnknownCalendarPropertyError,
} from './errors';
import { isCalendarCardProperty } from './propertyRegistry';

/**
 * The three preference keys SIK-138 V1 is allowed to persist. Any new key
 * requires updating requirements.md Requirement 7 first.
 */
export const HOME_CALENDAR_PREFERENCE_KEYS = [
  'homeCalendarView',
  'startWeekOnMonday',
  'cardLimitPerCell',
] as const;

export type HomeCalendarPreferenceKey = (typeof HOME_CALENDAR_PREFERENCE_KEYS)[number];

/**
 * Patch shape consumed by `useDashboardPreferenceStore.patchPreferences`.
 * Each field is optional so callers can write one knob at a time. Note
 * that `visibleProperties` is intentionally absent — Requirement 7
 * forbids persistence of that field in V1.
 */
export interface HomeCalendarPreferencePatch {
  readonly homeCalendarView?: CalendarView;
  readonly startWeekOnMonday?: boolean;
  readonly cardLimitPerCell?: number;
}

/** Narrow shape compatible with `dashboardPreferences`. */
type PreferencesLike = Readonly<Record<string, unknown>> | undefined | null;

const VIEW_LITERALS: ReadonlySet<CalendarView> = new Set(['today', 'week', 'month']);

/**
 * Returns the persisted calendar view if it matches one of the locked
 * literals, otherwise `null`.
 */
export function readHomeCalendarView(preferences: PreferencesLike): CalendarView | null {
  const value = preferences?.['homeCalendarView'];
  if (typeof value !== 'string') return null;
  return VIEW_LITERALS.has(value as CalendarView) ? (value as CalendarView) : null;
}

/**
 * Returns the persisted Monday-first flag, or `null` if missing /
 * malformed. Callers should fall back to the factory default (`true`).
 */
export function readStartWeekOnMonday(preferences: PreferencesLike): boolean | null {
  const value = preferences?.['startWeekOnMonday'];
  return typeof value === 'boolean' ? value : null;
}

/**
 * Returns the persisted month-cell limit if it parses as a positive
 * integer (or `Number.MAX_SAFE_INTEGER`). Otherwise `null`. The factory's
 * `assertLimit` rule is the ground truth; this reader only widens that
 * rule with the "missing key" case.
 */
export function readCardLimitPerCell(preferences: PreferencesLike): number | null {
  const value = preferences?.['cardLimitPerCell'];
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    return null;
  }
  return value;
}

/**
 * Builds a partial preferences patch suitable for `patchPreferences`. Any
 * invalid input throws the matching W2 error class, so callers can rely
 * on a successful return meaning every supplied field has been validated.
 *
 * `visibleProperties` is intentionally rejected: we accept it as a typed
 * input only to surface a clear `UnknownCalendarPropertyError` if a
 * future caller forgets Requirement 7. The thrown error references which
 * property names were forbidden.
 */
export function buildHomeCalendarPreferencePatch(
  input: HomeCalendarPreferencePatch & {
    readonly visibleProperties?: readonly CalendarCardProperty[];
  },
): HomeCalendarPreferencePatch {
  if (input.visibleProperties !== undefined) {
    // Requirement 7 forbids persisting visibleProperties. Surface the bad
    // field through the existing typed-error vocabulary so the call site
    // can log / reject with a single catch arm.
    for (const property of input.visibleProperties) {
      if (!isCalendarCardProperty(property)) {
        throw new UnknownCalendarPropertyError(property);
      }
    }
    throw new UnknownCalendarPropertyError(
      'visibleProperties is not a persisted preference (Requirement 7)',
    );
  }

  const patch: { -readonly [K in keyof HomeCalendarPreferencePatch]: HomeCalendarPreferencePatch[K] } = {};

  if (input.homeCalendarView !== undefined) {
    if (!VIEW_LITERALS.has(input.homeCalendarView)) {
      throw new InvalidCalendarViewError(input.homeCalendarView);
    }
    patch.homeCalendarView = input.homeCalendarView;
  }

  if (input.startWeekOnMonday !== undefined) {
    if (typeof input.startWeekOnMonday !== 'boolean') {
      throw new TypeError(
        `calendarViewConfig: startWeekOnMonday must be boolean, got ${typeof input.startWeekOnMonday}`,
      );
    }
    patch.startWeekOnMonday = input.startWeekOnMonday;
  }

  if (input.cardLimitPerCell !== undefined) {
    const limit = input.cardLimitPerCell;
    if (
      typeof limit !== 'number' ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > Number.MAX_SAFE_INTEGER
    ) {
      throw new InvalidCalendarLimitError(limit);
    }
    patch.cardLimitPerCell = limit;
  }

  return patch;
}
