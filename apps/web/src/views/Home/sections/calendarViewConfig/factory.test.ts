/*
 * calendarViewConfig/factory.test.ts — SIK-138 W2.
 *
 * Why: requirements.md Requirement 6 + design.md Factory rules lock the
 *      preset / default / override behavior. This suite is the runtime
 *      anchor for the equivalence and the four typed errors.
 */
import { describe, it, expect } from 'vitest';

import {
  createCalendarViewConfig,
  createCalendarViewConfigPreset,
  createDefaultCalendarViewConfig,
} from './factory';
import {
  InvalidCalendarLimitError,
  InvalidCalendarViewError,
  UnknownCalendarPresetError,
  UnknownCalendarPropertyError,
} from './errors';
import type { CalendarView } from './types';

const ALL_VIEWS: readonly CalendarView[] = ['week', 'month'];

describe('createCalendarViewConfigPreset', () => {
  it('compact preset locks visibleProperties to ["title", "kind"]', () => {
    for (const view of ALL_VIEWS) {
      const cfg = createCalendarViewConfigPreset(view, 'compact');
      expect(cfg.visibleProperties).toEqual(['title', 'kind']);
    }
  });

  it('default preset locks visibleProperties to ["title", "kind", "status"]', () => {
    for (const view of ALL_VIEWS) {
      const cfg = createCalendarViewConfigPreset(view, 'default');
      expect(cfg.visibleProperties).toEqual(['title', 'kind', 'status']);
    }
  });

  it('detail preset enumerates all 7 channels in the contract order', () => {
    for (const view of ALL_VIEWS) {
      const cfg = createCalendarViewConfigPreset(view, 'detail');
      expect(cfg.visibleProperties).toEqual([
        'title',
        'kind',
        'status',
        'category',
        'source',
        'linkedSession',
        'target',
      ]);
    }
  });

  it('default cardLimitPerCell is 3 for month/week', () => {
    expect(createCalendarViewConfigPreset('month', 'default').cardLimitPerCell).toBe(3);
    expect(createCalendarViewConfigPreset('week', 'default').cardLimitPerCell).toBe(3);
  });

  it('shared defaults are startWeekOnMonday=true and dateField="startAt"', () => {
    for (const view of ALL_VIEWS) {
      const cfg = createCalendarViewConfigPreset(view, 'default');
      expect(cfg.startWeekOnMonday).toBe(true);
      expect(cfg.dateField).toBe('startAt');
    }
  });

  it('returned configs are deeply frozen against accidental mutation', () => {
    const cfg = createCalendarViewConfigPreset('month', 'default');
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(Object.isFrozen(cfg.visibleProperties)).toBe(true);
    expect(() => {
      // @ts-expect-error verify runtime freeze contract
      cfg.cardLimitPerCell = 99;
    }).toThrow();
  });

  it('throws InvalidCalendarViewError for non-literal views', () => {
    expect(() =>
      // @ts-expect-error invalid view literal is rejected at runtime
      createCalendarViewConfigPreset('year', 'default'),
    ).toThrow(InvalidCalendarViewError);
    expect(() =>
      // @ts-expect-error invalid view type is rejected at runtime
      createCalendarViewConfigPreset(undefined, 'default'),
    ).toThrow(InvalidCalendarViewError);
  });

  it('throws UnknownCalendarPresetError for unknown preset names', () => {
    expect(() =>
      // @ts-expect-error invalid preset literal is rejected at runtime
      createCalendarViewConfigPreset('month', 'dense'),
    ).toThrow(UnknownCalendarPresetError);
    expect(() =>
      // @ts-expect-error invalid preset type is rejected at runtime
      createCalendarViewConfigPreset('month', null),
    ).toThrow(UnknownCalendarPresetError);
  });
});

describe('createDefaultCalendarViewConfig', () => {
  it('matches createCalendarViewConfigPreset(view, "default") deeply for every view', () => {
    for (const view of ALL_VIEWS) {
      expect(createDefaultCalendarViewConfig(view)).toEqual(
        createCalendarViewConfigPreset(view, 'default'),
      );
    }
  });

  it('rejects invalid view literals', () => {
    expect(() =>
      // @ts-expect-error invalid view literal is rejected at runtime
      createDefaultCalendarViewConfig('quarter'),
    ).toThrow(InvalidCalendarViewError);
  });
});

describe('createCalendarViewConfig (overrides)', () => {
  it('falls back to default preset values when no override is provided', () => {
    const cfg = createCalendarViewConfig({ view: 'month' });
    expect(cfg).toEqual(createDefaultCalendarViewConfig('month'));
  });

  it('honors a startWeekOnMonday=false override', () => {
    const cfg = createCalendarViewConfig({ view: 'week', startWeekOnMonday: false });
    expect(cfg.startWeekOnMonday).toBe(false);
  });

  it('honors a custom cardLimitPerCell when it is a positive integer', () => {
    const cfg = createCalendarViewConfig({ view: 'month', cardLimitPerCell: 5 });
    expect(cfg.cardLimitPerCell).toBe(5);
  });

  it('throws InvalidCalendarLimitError for non-integer or non-positive limits', () => {
    const invalidLimits: ReadonlyArray<unknown> = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '3'];
    for (const limit of invalidLimits) {
      expect(() =>
        createCalendarViewConfig({
          view: 'month',
          // @ts-expect-error verify the runtime guard rejects arbitrary inputs
          cardLimitPerCell: limit,
        }),
      ).toThrow(InvalidCalendarLimitError);
    }
  });

  it('honors a visibleProperties override and freezes the result', () => {
    const cfg = createCalendarViewConfig({
      view: 'week',
      visibleProperties: ['title', 'status'],
    });
    expect(cfg.visibleProperties).toEqual(['title', 'status']);
    expect(Object.isFrozen(cfg.visibleProperties)).toBe(true);
  });

  it('throws UnknownCalendarPropertyError when visibleProperties contains an unknown name', () => {
    expect(() =>
      createCalendarViewConfig({
        view: 'week',
        // @ts-expect-error invalid property name is rejected at runtime
        visibleProperties: ['title', 'duration'],
      }),
    ).toThrow(UnknownCalendarPropertyError);
  });

  it('rejects an invalid dateField override', () => {
    expect(() =>
      createCalendarViewConfig({
        view: 'week',
        // @ts-expect-error invalid dateField is rejected at runtime
        dateField: 'createdAt',
      }),
    ).toThrow(/dateField/);
  });

  it('rejects a non-boolean startWeekOnMonday override', () => {
    expect(() =>
      createCalendarViewConfig({
        view: 'week',
        // @ts-expect-error startWeekOnMonday is required to be boolean
        startWeekOnMonday: 'yes',
      }),
    ).toThrow(TypeError);
  });

  it('rejects an invalid view literal up front', () => {
    expect(() =>
      createCalendarViewConfig({
        // @ts-expect-error invalid view is rejected at runtime
        view: 'year',
      }),
    ).toThrow(InvalidCalendarViewError);
  });
});
