/*
 * calendarViewConfig/factory.ts — SIK-138 W2.
 *
 * Why: requirements.md Requirement 6 + design.md "Factory rules" lock the
 *      three density presets, the default config, and the equivalence
 *      between `default` preset and `createDefaultCalendarViewConfig`.
 *      All knobs go through one factory so panels and child views cannot
 *      hand-roll `visibleProperties` arrays or limit numbers.
 *
 *      AGENT-H7: every invalid input throws a typed error from
 *      `./errors`. There is no silent fallback; missing fields fall back
 *      to the documented `default` preset values *only* via the factory.
 */

import type {
  CalendarCardProperty,
  CalendarDensityPreset,
  CalendarView,
  CalendarViewConfig,
  CalendarViewConfigInput,
} from './types';
import {
  InvalidCalendarLimitError,
  InvalidCalendarViewError,
  UnknownCalendarPresetError,
} from './errors';
import { assertCalendarCardProperty } from './propertyRegistry';

const VIEW_LITERALS = ['today', 'week', 'month'] as const satisfies readonly CalendarView[];
const PRESET_LITERALS = [
  'compact',
  'default',
  'detail',
] as const satisfies readonly CalendarDensityPreset[];
const DATE_FIELD_LITERALS = ['startAt', 'endAt'] as const;

const VIEW_LOOKUP: ReadonlySet<CalendarView> = new Set(VIEW_LITERALS);
const PRESET_LOOKUP: ReadonlySet<CalendarDensityPreset> = new Set(PRESET_LITERALS);

// Frozen visible-property tuples per preset. Shared so default & preset
// `default` are deep-equal; each factory call returns a fresh config so a
// mutation in one render path cannot leak across consumers.
const PRESET_PROPERTIES: Readonly<
  Record<CalendarDensityPreset, readonly CalendarCardProperty[]>
> = Object.freeze({
  compact: Object.freeze(['title', 'kind'] as const),
  default: Object.freeze(['title', 'kind', 'status'] as const),
  detail: Object.freeze([
    'title',
    'kind',
    'status',
    'category',
    'source',
    'linkedSession',
    'target',
  ] as const),
});

const DEFAULT_LIMIT_PER_VIEW: Readonly<Record<CalendarView, number>> = Object.freeze({
  today: Number.MAX_SAFE_INTEGER,
  week: 3,
  month: 3,
});

function assertView(view: unknown): asserts view is CalendarView {
  if (typeof view !== 'string' || !VIEW_LOOKUP.has(view as CalendarView)) {
    throw new InvalidCalendarViewError(view);
  }
}

function assertPreset(preset: unknown): asserts preset is CalendarDensityPreset {
  if (typeof preset !== 'string' || !PRESET_LOOKUP.has(preset as CalendarDensityPreset)) {
    throw new UnknownCalendarPresetError(preset);
  }
}

function assertLimit(limit: unknown): asserts limit is number {
  // `Number.MAX_SAFE_INTEGER` is the "no limit" sentinel for today / week.
  if (
    typeof limit !== 'number' ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > Number.MAX_SAFE_INTEGER
  ) {
    throw new InvalidCalendarLimitError(limit);
  }
}

function assertDateField(value: unknown): asserts value is CalendarViewConfig['dateField'] {
  // dateField is internal-only; a plain Error suffices since Requirement 2
  // names only the four typed errors below.
  if (typeof value !== 'string' || !(DATE_FIELD_LITERALS as readonly string[]).includes(value)) {
    throw new Error(
      `calendarViewConfig: invalid dateField ${JSON.stringify(value)}; expected "startAt" | "endAt"`,
    );
  }
}

function freezeProperties(
  properties: readonly CalendarCardProperty[],
): readonly CalendarCardProperty[] {
  for (const property of properties) {
    assertCalendarCardProperty(property);
  }
  return Object.freeze([...properties]);
}

/**
 * Build the canonical config for `(view, preset)`. The returned object is
 * frozen at the top level; `visibleProperties` is also frozen.
 */
export function createCalendarViewConfigPreset(
  view: CalendarView,
  preset: CalendarDensityPreset,
): CalendarViewConfig {
  assertView(view);
  assertPreset(preset);
  return Object.freeze({
    view,
    startWeekOnMonday: true,
    cardLimitPerCell: DEFAULT_LIMIT_PER_VIEW[view],
    dateField: 'startAt',
    visibleProperties: PRESET_PROPERTIES[preset],
  });
}

/**
 * Sugar for `createCalendarViewConfigPreset(view, 'default')`. The two
 * functions must produce deep-equal output; `factory.test.ts` enforces
 * the equivalence.
 */
export function createDefaultCalendarViewConfig(view: CalendarView): CalendarViewConfig {
  return createCalendarViewConfigPreset(view, 'default');
}

/**
 * Build a config from explicit overrides. Missing fields take the
 * `default` preset value for the requested view; every supplied field is
 * validated. Unknown property names in `visibleProperties` throw
 * `UnknownCalendarPropertyError` — there is no silent skip.
 */
export function createCalendarViewConfig(
  input: CalendarViewConfigInput,
): CalendarViewConfig {
  assertView(input.view);
  const baseline = createDefaultCalendarViewConfig(input.view);

  const startWeekOnMonday =
    input.startWeekOnMonday === undefined ? baseline.startWeekOnMonday : input.startWeekOnMonday;
  if (typeof startWeekOnMonday !== 'boolean') {
    throw new TypeError(
      `calendarViewConfig: startWeekOnMonday must be boolean, got ` +
        `${typeof startWeekOnMonday}`,
    );
  }

  const cardLimitPerCell =
    input.cardLimitPerCell === undefined ? baseline.cardLimitPerCell : input.cardLimitPerCell;
  assertLimit(cardLimitPerCell);

  const dateField = input.dateField === undefined ? baseline.dateField : input.dateField;
  assertDateField(dateField);

  const visibleProperties =
    input.visibleProperties === undefined
      ? baseline.visibleProperties
      : freezeProperties(input.visibleProperties);

  return Object.freeze({
    view: input.view,
    startWeekOnMonday,
    cardLimitPerCell,
    dateField,
    visibleProperties,
  });
}
