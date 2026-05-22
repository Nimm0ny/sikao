import { describe, expect, it } from 'vitest';

import {
  computeColumnGeometry,
  moveEventByDays,
  slicePracticeBlocks,
} from '@/components/dashboard-sikao/plan/planRuntime';

describe('planRuntime moveEventByDays', () => {
  it('preserves local wall-clock time across DST boundaries', () => {
    const patch = moveEventByDays(
      {
        id: 'nyc-dst',
        planId: 11,
        title: 'DST block',
        category: 'review',
        notes: '',
        startAt: '2026-03-07T14:00:00.000Z',
        endAt: '2026-03-07T15:00:00.000Z',
        timezone: 'America/New_York',
        status: 'planned',
        source: 'user_manual',
        parentId: null,
        recurringRule: null,
        recurringParentId: null,
        recurringExceptionDates: [],
        linkedSessionId: null,
        targetId: null,
        deletedAt: null,
        isRecurringInstance: false,
      },
      '2026-03-07',
      '2026-03-08',
    );

    expect(patch.startAt).toBe('2026-03-08T13:00:00.000Z');
    expect(patch.endAt).toBe('2026-03-08T14:00:00.000Z');
  });

  it('keeps overlap columns inside the day cell for 4 concurrent events', () => {
    const geometry = computeColumnGeometry(3, 4);

    expect(geometry.leftPercent + geometry.widthPercent).toBeLessThanOrEqual(100);
    expect(geometry.widthPercent).toBeGreaterThan(0);
  });

  it('keeps overlap columns inside the day cell for 8 concurrent events', () => {
    const geometry = computeColumnGeometry(7, 8);

    expect(geometry.leftPercent + geometry.widthPercent).toBeLessThanOrEqual(100);
    expect(geometry.widthPercent).toBeGreaterThan(0);
  });

  it('slices cross-day practice blocks into one slice per local day', () => {
    const slices = slicePracticeBlocks([
      {
        id: 'practice-cross-day',
        category: 'practice',
        subject: 'xingce',
        sessionId: 7,
        startAt: '2026-05-22T15:30:00.000Z',
        endAt: '2026-05-22T16:30:00.000Z',
        itemsCount: 20,
        isInProgress: false,
        accuracy: '0.80',
      },
    ]);

    expect(slices).toHaveLength(2);
    expect(slices[0]).toMatchObject({ day: '2026-05-22', startMinutes: 1410, endMinutes: 1440 });
    expect(slices[1]).toMatchObject({ day: '2026-05-23', startMinutes: 0, endMinutes: 30 });
  });
});
