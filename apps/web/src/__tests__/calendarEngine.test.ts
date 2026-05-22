import { describe, expect, it } from 'vitest';

import {
  buildOverlapLayout,
  buildViewRange,
  detectConflicts,
  endOfLocalDay,
  expandRecurringOccurrences,
  shiftOccurrenceByMinutes,
  sliceOccurrenceByDay,
  startOfLocalDay,
} from '@sikao/calendar-engine';

describe('calendar engine', () => {
  it('handles local day boundaries across DST', () => {
    expect(
      startOfLocalDay('2026-03-08', 'America/Los_Angeles').toISOString(),
    ).toBe('2026-03-08T08:00:00.000Z');
    expect(
      endOfLocalDay('2026-03-08', 'America/Los_Angeles').toISOString(),
    ).toBe('2026-03-09T07:00:00.000Z');
    expect(
      startOfLocalDay('2026-03-09', 'America/Los_Angeles').toISOString(),
    ).toBe('2026-03-09T07:00:00.000Z');
  });

  it('expands recurrence, applies exceptions, and detached overrides', () => {
    const occurrences = expandRecurringOccurrences(
      {
        id: '11',
        startAt: '2026-05-22T01:00:00.000Z',
        endAt: '2026-05-22T02:00:00.000Z',
        timeZone: 'Asia/Shanghai',
        recurringRule: 'FREQ=DAILY;COUNT=3',
        recurringExceptionDates: ['2026-05-23'],
        detachedOccurrences: {
          '11:2026-05-24': {
            startAt: '2026-05-24T03:00:00.000Z',
            endAt: '2026-05-24T04:00:00.000Z',
          },
        },
      },
      {
        from: '2026-05-21T00:00:00.000Z',
        to: '2026-05-26T00:00:00.000Z',
      },
    );

    expect(occurrences).toHaveLength(2);
    expect(occurrences[1]?.isDetached).toBe(true);
    expect(occurrences[1]?.startAt).toBe('2026-05-24T03:00:00.000Z');
  });

  it('retains recurring occurrences whose starts are outside the window but still overlap it', () => {
    const occurrences = expandRecurringOccurrences(
      {
        id: 'overnight',
        startAt: '2026-05-22T23:30:00.000Z',
        endAt: '2026-05-23T01:30:00.000Z',
        timeZone: 'UTC',
        recurringRule: 'FREQ=DAILY;COUNT=2',
        recurringExceptionDates: [],
      },
      {
        from: '2026-05-23T00:00:00.000Z',
        to: '2026-05-23T23:59:59.000Z',
      },
    );

    expect(occurrences).toHaveLength(2);
    expect(occurrences[0]?.occurrenceRef).toBe('overnight:2026-05-22');
    expect(occurrences[1]?.occurrenceRef).toBe('overnight:2026-05-23');
  });

  it('detects conflicts and assigns overlap columns', () => {
    const occurrences = [
      {
        id: 'a',
        sourceId: 'a',
        occurrenceRef: 'a:2026-05-22',
        startAt: '2026-05-22T01:00:00.000Z',
        endAt: '2026-05-22T02:30:00.000Z',
        timeZone: 'Asia/Shanghai',
        isDetached: false,
      },
      {
        id: 'b',
        sourceId: 'b',
        occurrenceRef: 'b:2026-05-22',
        startAt: '2026-05-22T01:30:00.000Z',
        endAt: '2026-05-22T03:00:00.000Z',
        timeZone: 'Asia/Shanghai',
        isDetached: false,
      },
    ] as const;

    const conflicts = detectConflicts(occurrences);
    const layout = buildOverlapLayout(occurrences);

    expect(conflicts).toHaveLength(1);
    expect(layout['a:2026-05-22']?.totalColumns).toBe(2);
    expect(layout['b:2026-05-22']?.column).toBe(1);
  });

  it('builds date windows, snaps drag deltas, and slices cross-day events', () => {
    const range = buildViewRange('week', {
      anchorDate: '2026-05-22',
      timeZone: 'Asia/Shanghai',
    });
    expect(range.from).toContain('2026-05-17');

    const shifted = shiftOccurrenceByMinutes(
      {
        startAt: '2026-05-22T01:00:00.000Z',
        endAt: '2026-05-22T02:00:00.000Z',
      },
      17,
    );
    expect(shifted.startAt).toBe('2026-05-22T01:15:00.000Z');

    const slices = sliceOccurrenceByDay({
      id: '11',
      sourceId: '11',
      occurrenceRef: '11:2026-05-22',
      startAt: '2026-05-22T14:00:00.000Z',
      endAt: '2026-05-22T18:30:00.000Z',
      timeZone: 'Asia/Shanghai',
      isDetached: false,
    });
    expect(slices).toHaveLength(2);
    expect(slices[0]?.isStartSlice).toBe(true);
    expect(slices[1]?.isEndSlice).toBe(true);
  });

  it('slices multi-day events across DST boundary without stalling on the same day', () => {
    const slices = sliceOccurrenceByDay({
      id: 'dst',
      sourceId: 'dst',
      occurrenceRef: 'dst:2026-03-08',
      startAt: '2026-03-08T09:30:00.000Z',
      endAt: '2026-03-09T08:30:00.000Z',
      timeZone: 'America/Los_Angeles',
      isDetached: false,
    });

    expect(slices.map((slice) => slice.day)).toEqual(['2026-03-08', '2026-03-09']);
  });
});
