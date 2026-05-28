/*
 * calendarViewConfig/propertyRegistry.test.ts — SIK-138 W2.
 *
 * Why: visual contract §3 + design.md MonthEventChip channels lock the
 *      seven `CalendarCardProperty` names. The registry is the runtime
 *      enforcement point; this suite asserts both the predicate and the
 *      assertion path so a future contributor cannot silently widen the
 *      union type.
 */
import { describe, it, expect } from 'vitest';

import {
  CALENDAR_CARD_PROPERTIES,
  assertCalendarCardProperty,
  isCalendarCardProperty,
} from './propertyRegistry';
import { UnknownCalendarPropertyError } from './errors';

describe('CALENDAR_CARD_PROPERTIES', () => {
  it('lists exactly the seven channels locked by the visual contract', () => {
    expect([...CALENDAR_CARD_PROPERTIES]).toEqual([
      'title',
      'kind',
      'status',
      'category',
      'source',
      'linkedSession',
      'target',
    ]);
  });

  it('contains no duplicates', () => {
    expect(new Set(CALENDAR_CARD_PROPERTIES).size).toBe(CALENDAR_CARD_PROPERTIES.length);
  });
});

describe('isCalendarCardProperty', () => {
  it('accepts every name in the registry', () => {
    for (const name of CALENDAR_CARD_PROPERTIES) {
      expect(isCalendarCardProperty(name)).toBe(true);
    }
  });

  it('rejects strings outside the registry', () => {
    const rejected = ['duration', 'accuracy', 'count', '', 'Title'];
    for (const value of rejected) {
      expect(isCalendarCardProperty(value)).toBe(false);
    }
  });

  it('rejects non-string inputs', () => {
    const rejected: ReadonlyArray<unknown> = [null, undefined, 0, 1, true, {}, []];
    for (const value of rejected) {
      expect(isCalendarCardProperty(value)).toBe(false);
    }
  });
});

describe('assertCalendarCardProperty', () => {
  it('returns void for valid names', () => {
    for (const name of CALENDAR_CARD_PROPERTIES) {
      expect(() => {
        assertCalendarCardProperty(name);
      }).not.toThrow();
    }
  });

  it('throws UnknownCalendarPropertyError for unknown names with the offending value attached', () => {
    try {
      assertCalendarCardProperty('duration');
      throw new Error('assertion should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownCalendarPropertyError);
      expect((err as UnknownCalendarPropertyError).value).toBe('duration');
      expect((err as UnknownCalendarPropertyError).message).toContain('duration');
    }
  });

  it('rejects non-string inputs with UnknownCalendarPropertyError', () => {
    expect(() => {
      assertCalendarCardProperty(null);
    }).toThrow(UnknownCalendarPropertyError);
    expect(() => {
      assertCalendarCardProperty(42);
    }).toThrow(UnknownCalendarPropertyError);
  });
});
