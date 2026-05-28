/*
 * calendarEvents.test.ts — SIK-138 W4.5.
 *
 * Why: requirements.md Requirement 10 mandates recurring expansion in all
 *      three views and cross-day slicing in the month view. This suite is
 *      the engine-bridge regression net: it locks the projection
 *      semantics independently of any view DOM so future view tweaks
 *      cannot silently regress correctness.
 */
import { describe, it, expect } from 'vitest';

import {
  eventToCalendarInput,
  expandPlanEventsForView,
  sliceMonthOccurrencesByDay,
} from './calendarEvents';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

const TZ = 'Asia/Shanghai';

function makeEvent(overrides: Partial<PlanEventReadV2> & Pick<PlanEventReadV2, 'id' | 'startAt' | 'endAt'>): PlanEventReadV2 {
  return {
    title: 'Sample',
    category: 'practice',
    status: 'planned',
    source: 'manual',
    timezone: TZ,
    notes: '',
    planId: 1,
    isRecurringInstance: false,
    deletedAt: null,
    linkedSessionId: null,
    parentId: null,
    recurringExceptionDates: [],
    recurringParentId: null,
    recurringRule: null,
    targetId: null,
    ...overrides,
  } as PlanEventReadV2;
}

describe('eventToCalendarInput', () => {
  it('forwards the recurringRule and exception dates', () => {
    const event = makeEvent({
      id: 'e1',
      startAt: '2026-05-25T08:00:00+08:00',
      endAt: '2026-05-25T09:00:00+08:00',
      recurringRule: 'RRULE:FREQ=DAILY;COUNT=3',
      recurringExceptionDates: ['2026-05-26'],
    });
    const input = eventToCalendarInput(event);
    expect(input.id).toBe('e1');
    expect(input.recurringRule).toBe('RRULE:FREQ=DAILY;COUNT=3');
    expect(input.recurringExceptionDates).toEqual(['2026-05-26']);
    expect(input.timeZone).toBe(TZ);
  });

  it('coerces a missing recurringRule to null', () => {
    const event = makeEvent({
      id: 'e1',
      startAt: '2026-05-25T08:00:00+08:00',
      endAt: '2026-05-25T09:00:00+08:00',
    });
    expect(eventToCalendarInput(event).recurringRule).toBeNull();
  });
});

describe('expandPlanEventsForView', () => {
  const window = {
    from: '2026-05-25T00:00:00+08:00',
    to: '2026-05-31T23:59:59+08:00',
  } as const;

  it('emits one occurrence for non-recurring events overlapping the window', () => {
    const event = makeEvent({
      id: 'e1',
      startAt: '2026-05-26T09:00:00+08:00',
      endAt: '2026-05-26T10:00:00+08:00',
    });
    const occurrences = expandPlanEventsForView([event], window);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].event.id).toBe('e1');
    expect(occurrences[0].occurrence.startAt).toBe('2026-05-26T09:00:00+08:00');
    expect(occurrences[0].occurrence.endAt).toBe('2026-05-26T10:00:00+08:00');
  });

  it('drops non-recurring events outside the window', () => {
    const event = makeEvent({
      id: 'e1',
      startAt: '2026-04-01T09:00:00+08:00',
      endAt: '2026-04-01T10:00:00+08:00',
    });
    expect(expandPlanEventsForView([event], window)).toEqual([]);
  });

  it('expands a daily recurring event into one occurrence per day in the window', () => {
    const event = makeEvent({
      id: 'r1',
      startAt: '2026-05-25T08:00:00+08:00',
      endAt: '2026-05-25T09:00:00+08:00',
      recurringRule: 'RRULE:FREQ=DAILY;COUNT=5',
    });
    const occurrences = expandPlanEventsForView([event], window);
    expect(occurrences).toHaveLength(5);
    for (const item of occurrences) {
      expect(item.event.id).toBe('r1');
    }
  });

  it('honors recurringExceptionDates and removes the matching occurrence', () => {
    const event = makeEvent({
      id: 'r1',
      startAt: '2026-05-25T08:00:00+08:00',
      endAt: '2026-05-25T09:00:00+08:00',
      recurringRule: 'RRULE:FREQ=DAILY;COUNT=5',
      recurringExceptionDates: ['2026-05-26'],
    });
    const occurrences = expandPlanEventsForView([event], window);
    expect(occurrences).toHaveLength(4);
    const days = occurrences.map((o) => o.occurrence.occurrenceRef.split(':')[1]);
    expect(days).not.toContain('2026-05-26');
  });
});

describe('sliceMonthOccurrencesByDay', () => {
  it('returns one slice per day for single-day events', () => {
    const event = makeEvent({
      id: 'e1',
      startAt: '2026-05-26T09:00:00+08:00',
      endAt: '2026-05-26T10:00:00+08:00',
    });
    const enriched = expandPlanEventsForView([event], {
      from: '2026-05-25T00:00:00+08:00',
      to: '2026-05-31T23:59:59+08:00',
    });
    const slices = sliceMonthOccurrencesByDay(enriched);
    expect(slices).toHaveLength(1);
    expect(slices[0].slice.day).toBe('2026-05-26');
    expect(slices[0].slice.isStartSlice).toBe(true);
    expect(slices[0].slice.isEndSlice).toBe(true);
  });

  it('emits a slice for every day a cross-day event touches', () => {
    const event = makeEvent({
      id: 'e1',
      startAt: '2026-05-26T22:00:00+08:00',
      endAt: '2026-05-28T04:00:00+08:00',
    });
    const enriched = expandPlanEventsForView([event], {
      from: '2026-05-25T00:00:00+08:00',
      to: '2026-05-31T23:59:59+08:00',
    });
    const slices = sliceMonthOccurrencesByDay(enriched);
    const days = slices.map((s) => s.slice.day);
    expect(days).toEqual(['2026-05-26', '2026-05-27', '2026-05-28']);
    expect(slices[0].slice.isStartSlice).toBe(true);
    expect(slices[0].slice.isEndSlice).toBe(false);
    expect(slices[1].slice.isStartSlice).toBe(false);
    expect(slices[1].slice.isEndSlice).toBe(false);
    expect(slices[2].slice.isStartSlice).toBe(false);
    expect(slices[2].slice.isEndSlice).toBe(true);
  });
});
