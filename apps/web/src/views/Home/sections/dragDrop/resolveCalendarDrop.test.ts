/*
 * resolveCalendarDrop tests — SIK-139 W2.
 *
 * Why: this pure resolver owns the drop branch logic (Requirement 4 / 6).
 *      Covers cancel (outside / no data), noop (same day), and reschedule
 *      (shifted times) decisions, plus the malformed-time throw that the
 *      component turns into a toast.
 */
import { describe, it, expect } from 'vitest';

import { resolveCalendarDrop, type DropDragData } from './resolveCalendarDrop';

const DATA: DropDragData = {
  eventId: 'm1',
  fromDay: '2026-05-15',
  startAt: '2026-05-15T09:00:00.000Z',
  endAt: '2026-05-15T10:00:00.000Z',
  title: '专项练习',
};

describe('resolveCalendarDrop', () => {
  it('cancels when dropped outside any cell (overId null)', () => {
    expect(resolveCalendarDrop(DATA, null)).toEqual({ kind: 'cancel' });
  });

  it('cancels when drag data is missing (defensive)', () => {
    expect(resolveCalendarDrop(null, '2026-05-16')).toEqual({ kind: 'cancel' });
  });

  it('is a no-op when dropped on the same day', () => {
    expect(resolveCalendarDrop(DATA, '2026-05-15')).toEqual({ kind: 'noop' });
  });

  it('reschedules to the target day, preserving time-of-day and duration', () => {
    const decision = resolveCalendarDrop(DATA, '2026-05-18');
    expect(decision).toEqual({
      kind: 'reschedule',
      eventId: 'm1',
      title: '专项练习',
      startAt: '2026-05-18T09:00:00.000Z',
      endAt: '2026-05-18T10:00:00.000Z',
    });
  });

  it('throws (for the caller to toast) when the event times are malformed', () => {
    const bad: DropDragData = { ...DATA, startAt: 'nope', endAt: 'nope' };
    expect(() => resolveCalendarDrop(bad, '2026-05-18')).toThrow(/unparseable/);
  });
});
