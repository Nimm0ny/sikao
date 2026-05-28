/*
 * calendarViewConfig/propertyRegistry.ts — SIK-138 W2.
 *
 * Why: visual contract §3 locks the 7 chip channels. The registry is the
 *      single source for both the type-narrowing predicate
 *      (`isCalendarCardProperty`) and the assertion helper used by the
 *      factory (`assertCalendarCardProperty`). Keeping the list in one
 *      module prevents the well-known drift where a future contributor
 *      adds an 8th name to the union type but forgets the runtime guard.
 *
 *      AGENT-H7: assertion fails fast with `UnknownCalendarPropertyError`;
 *      no silent coercion, no default fallback.
 */

import type { CalendarCardProperty } from './types';
import { UnknownCalendarPropertyError } from './errors';

/**
 * Frozen, ordered list of every `CalendarCardProperty` accepted by the
 * factory. The tuple order doubles as the canonical detail-preset
 * ordering, so do not reorder casually — `factory.test.ts` asserts the
 * `detail` preset matches this list element-for-element.
 */
export const CALENDAR_CARD_PROPERTIES = [
  'title',
  'kind',
  'status',
  'category',
  'source',
  'linkedSession',
  'target',
] as const satisfies readonly CalendarCardProperty[];

const PROPERTY_LOOKUP: ReadonlySet<CalendarCardProperty> = new Set(
  CALENDAR_CARD_PROPERTIES,
);

export function isCalendarCardProperty(value: unknown): value is CalendarCardProperty {
  return typeof value === 'string' && PROPERTY_LOOKUP.has(value as CalendarCardProperty);
}

export function assertCalendarCardProperty(value: unknown): asserts value is CalendarCardProperty {
  if (!isCalendarCardProperty(value)) {
    throw new UnknownCalendarPropertyError(value);
  }
}
