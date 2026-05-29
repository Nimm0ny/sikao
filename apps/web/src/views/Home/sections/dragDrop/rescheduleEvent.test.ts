/*
 * rescheduleEvent tests — SIK-139 W2.
 *
 * Why: requirements Requirement 4 (time preserved, whole-day shift) +
 *      Requirement 6 (fail-fast on malformed input). Covers same-day no-op,
 *      forward / backward / cross-month shifts, duration + time-of-day
 *      preservation, and explicit throws.
 */
import { describe, it, expect } from 'vitest';

import { rescheduleEvent } from './rescheduleEvent';

const EVENT = {
  startAt: '2026-05-26T08:00:00.000Z',
  endAt: '2026-05-26T09:30:00.000Z',
} as const;

describe('rescheduleEvent', () => {
  it('returns the unchanged pair for a same-day drop (delta 0)', () => {
    const out = rescheduleEvent(EVENT, '2026-05-26', '2026-05-26');
    expect(out.startAt).toBe('2026-05-26T08:00:00.000Z');
    expect(out.endAt).toBe('2026-05-26T09:30:00.000Z');
  });

  it('shifts forward by whole days, preserving time-of-day and duration', () => {
    const out = rescheduleEvent(EVENT, '2026-05-26', '2026-05-29');
    expect(out.startAt).toBe('2026-05-29T08:00:00.000Z');
    expect(out.endAt).toBe('2026-05-29T09:30:00.000Z');
  });

  it('shifts backward by whole days', () => {
    const out = rescheduleEvent(EVENT, '2026-05-26', '2026-05-24');
    expect(out.startAt).toBe('2026-05-24T08:00:00.000Z');
    expect(out.endAt).toBe('2026-05-24T09:30:00.000Z');
  });

  it('shifts across a month boundary', () => {
    const out = rescheduleEvent(EVENT, '2026-05-26', '2026-06-02');
    expect(out.startAt).toBe('2026-06-02T08:00:00.000Z');
    expect(out.endAt).toBe('2026-06-02T09:30:00.000Z');
  });

  it('preserves a multi-day (cross-day) duration when shifting', () => {
    const crossDay = {
      startAt: '2026-05-26T22:00:00.000Z',
      endAt: '2026-05-27T01:00:00.000Z',
    };
    const out = rescheduleEvent(crossDay, '2026-05-26', '2026-05-28');
    expect(out.startAt).toBe('2026-05-28T22:00:00.000Z');
    expect(out.endAt).toBe('2026-05-29T01:00:00.000Z');
  });

  it('throws on a malformed day stamp (fail-fast, no silent fallback)', () => {
    expect(() => rescheduleEvent(EVENT, '2026-05-26', '2026/05/29')).toThrow(/YYYY-MM-DD/);
    expect(() => rescheduleEvent(EVENT, 'not-a-day', '2026-05-29')).toThrow(/YYYY-MM-DD/);
  });

  it('throws on an unparseable event time (fail-fast)', () => {
    expect(() =>
      rescheduleEvent({ startAt: 'nope', endAt: 'nope' }, '2026-05-26', '2026-05-29'),
    ).toThrow(/unparseable/);
  });
});
