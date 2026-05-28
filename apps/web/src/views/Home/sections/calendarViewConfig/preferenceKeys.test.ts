/*
 * calendarViewConfig/preferenceKeys.test.ts — SIK-138 W3.
 *
 * Why: Requirement 7 limits the persisted preference surface to three
 *      keys. This suite locks the readers, the write builder, and the
 *      explicit refusal of `visibleProperties` so a future contributor
 *      cannot silently extend the persisted shape.
 */
import { describe, it, expect } from 'vitest';

import {
  HOME_CALENDAR_PREFERENCE_KEYS,
  buildHomeCalendarPreferencePatch,
  readCardLimitPerCell,
  readHomeCalendarView,
  readStartWeekOnMonday,
} from './preferenceKeys';
import {
  InvalidCalendarLimitError,
  InvalidCalendarViewError,
  UnknownCalendarPropertyError,
} from './errors';

describe('HOME_CALENDAR_PREFERENCE_KEYS', () => {
  it('contains exactly the three keys allowed by Requirement 7', () => {
    expect([...HOME_CALENDAR_PREFERENCE_KEYS]).toEqual([
      'homeCalendarView',
      'startWeekOnMonday',
      'cardLimitPerCell',
    ]);
  });

  it('contains no duplicates', () => {
    expect(new Set(HOME_CALENDAR_PREFERENCE_KEYS).size).toBe(
      HOME_CALENDAR_PREFERENCE_KEYS.length,
    );
  });
});

describe('readHomeCalendarView', () => {
  it('returns the literal when the persisted value matches', () => {
    expect(readHomeCalendarView({ homeCalendarView: 'today' })).toBe('today');
    expect(readHomeCalendarView({ homeCalendarView: 'week' })).toBe('week');
    expect(readHomeCalendarView({ homeCalendarView: 'month' })).toBe('month');
  });

  it('returns null for unknown literals, wrong types, or missing keys', () => {
    expect(readHomeCalendarView({ homeCalendarView: 'year' })).toBeNull();
    expect(readHomeCalendarView({ homeCalendarView: 0 })).toBeNull();
    expect(readHomeCalendarView({})).toBeNull();
    expect(readHomeCalendarView(undefined)).toBeNull();
    expect(readHomeCalendarView(null)).toBeNull();
  });
});

describe('readStartWeekOnMonday', () => {
  it('returns the boolean when persisted', () => {
    expect(readStartWeekOnMonday({ startWeekOnMonday: true })).toBe(true);
    expect(readStartWeekOnMonday({ startWeekOnMonday: false })).toBe(false);
  });

  it('returns null for non-boolean / missing values', () => {
    expect(readStartWeekOnMonday({ startWeekOnMonday: 'true' })).toBeNull();
    expect(readStartWeekOnMonday({ startWeekOnMonday: 1 })).toBeNull();
    expect(readStartWeekOnMonday({})).toBeNull();
    expect(readStartWeekOnMonday(undefined)).toBeNull();
  });
});

describe('readCardLimitPerCell', () => {
  it('accepts positive integers and the max-safe sentinel', () => {
    expect(readCardLimitPerCell({ cardLimitPerCell: 1 })).toBe(1);
    expect(readCardLimitPerCell({ cardLimitPerCell: 3 })).toBe(3);
    expect(readCardLimitPerCell({ cardLimitPerCell: Number.MAX_SAFE_INTEGER })).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('returns null for malformed values', () => {
    const malformed: ReadonlyArray<unknown> = [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '3',
      true,
      null,
    ];
    for (const value of malformed) {
      expect(readCardLimitPerCell({ cardLimitPerCell: value })).toBeNull();
    }
    expect(readCardLimitPerCell({})).toBeNull();
    expect(readCardLimitPerCell(undefined)).toBeNull();
  });
});

describe('buildHomeCalendarPreferencePatch', () => {
  it('returns an empty object when no fields are supplied', () => {
    expect(buildHomeCalendarPreferencePatch({})).toEqual({});
  });

  it('forwards a valid view literal', () => {
    expect(buildHomeCalendarPreferencePatch({ homeCalendarView: 'week' })).toEqual({
      homeCalendarView: 'week',
    });
  });

  it('forwards a valid Monday-first flag', () => {
    expect(buildHomeCalendarPreferencePatch({ startWeekOnMonday: false })).toEqual({
      startWeekOnMonday: false,
    });
  });

  it('forwards a valid month-cell limit', () => {
    expect(buildHomeCalendarPreferencePatch({ cardLimitPerCell: 5 })).toEqual({
      cardLimitPerCell: 5,
    });
  });

  it('combines fields in a single patch when valid', () => {
    expect(
      buildHomeCalendarPreferencePatch({
        homeCalendarView: 'month',
        startWeekOnMonday: true,
        cardLimitPerCell: 4,
      }),
    ).toEqual({
      homeCalendarView: 'month',
      startWeekOnMonday: true,
      cardLimitPerCell: 4,
    });
  });

  it('rejects unknown view literals with InvalidCalendarViewError', () => {
    expect(() =>
      buildHomeCalendarPreferencePatch({
        // @ts-expect-error invalid view literal is rejected at runtime
        homeCalendarView: 'year',
      }),
    ).toThrow(InvalidCalendarViewError);
  });

  it('rejects malformed Monday-first values with TypeError', () => {
    expect(() =>
      buildHomeCalendarPreferencePatch({
        // @ts-expect-error startWeekOnMonday must be boolean
        startWeekOnMonday: 'yes',
      }),
    ).toThrow(TypeError);
  });

  it('rejects malformed limits with InvalidCalendarLimitError', () => {
    expect(() =>
      buildHomeCalendarPreferencePatch({ cardLimitPerCell: 0 }),
    ).toThrow(InvalidCalendarLimitError);
    expect(() =>
      buildHomeCalendarPreferencePatch({ cardLimitPerCell: 1.5 }),
    ).toThrow(InvalidCalendarLimitError);
    expect(() =>
      // @ts-expect-error limit must be a number
      buildHomeCalendarPreferencePatch({ cardLimitPerCell: '3' }),
    ).toThrow(InvalidCalendarLimitError);
  });

  it('rejects any visibleProperties write with UnknownCalendarPropertyError', () => {
    // V1 forbids persisting visibleProperties. Both well-formed and
    // malformed inputs must throw — Requirement 7 is enforced at the
    // write boundary, not silently dropped.
    expect(() =>
      buildHomeCalendarPreferencePatch({
        visibleProperties: ['title', 'kind'],
      }),
    ).toThrow(UnknownCalendarPropertyError);
    expect(() =>
      buildHomeCalendarPreferencePatch({
        // @ts-expect-error invalid property name is rejected at runtime
        visibleProperties: ['title', 'duration'],
      }),
    ).toThrow(UnknownCalendarPropertyError);
  });
});
