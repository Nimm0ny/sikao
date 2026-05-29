/*
 * conflictGuard tests — SIK-139 W3.
 *
 * Why: the conflict pre-check is the H7 fail-fast critical path. These tests
 *      pin the three branches the design Decisions 1 keeps strictly apart:
 *        - empty conflicts  → { hasConflict: false } (normal "clear" return)
 *        - non-empty        → { hasConflict: true, conflicts } (normal return,
 *                              the caller opens the confirm dialog)
 *        - request rejects  → re-throws (NEVER coerced to "no conflict")
 *      Plus the H6 window boundary: UTC ISO instants are mapped to their
 *      Asia/Shanghai calendar day before being sent as the date window.
 */
import { describe, it, expect, vi } from 'vitest';

import {
  checkDropConflicts,
  zonedDateKey,
  type ConflictGuardInput,
} from './conflictGuard';
import type {
  EventConflictsRequestV2,
  EventConflictsResponseV2,
  ProposedPlanEventV2,
} from '@sikao/api-client/types/home';

const PROPOSED: ProposedPlanEventV2 = {
  title: '专项练习',
  category: 'practice',
  startAt: '2026-05-18T01:00:00.000Z',
  endAt: '2026-05-18T02:00:00.000Z',
  timezone: 'Asia/Shanghai',
};

const INPUT: ConflictGuardInput = {
  proposed: PROPOSED,
  // buildViewRange('month') hands UTC instants; 2026-04-30T16:00Z is
  // 2026-05-01 00:00 in +08:00, 2026-05-31T15:59Z is 2026-05-31 in +08:00.
  window: { from: '2026-04-30T16:00:00.000Z', to: '2026-05-31T15:59:59.999Z' },
  timeZone: 'Asia/Shanghai',
};

describe('zonedDateKey', () => {
  it('maps a UTC instant to its Asia/Shanghai calendar day', () => {
    expect(zonedDateKey('2026-04-30T16:00:00.000Z', 'Asia/Shanghai')).toBe('2026-05-01');
    expect(zonedDateKey('2026-05-31T15:59:59.999Z', 'Asia/Shanghai')).toBe('2026-05-31');
  });

  it('throws on an unparseable instant (no silent fallback, H7)', () => {
    expect(() => zonedDateKey('not-a-date', 'Asia/Shanghai')).toThrow(/unparseable/);
  });
});

describe('checkDropConflicts', () => {
  it('returns hasConflict=false when the server reports no conflicts', async () => {
    const detect = vi.fn<[EventConflictsRequestV2], Promise<EventConflictsResponseV2>>(
      async () => ({ conflicts: [] }),
    );
    const result = await checkDropConflicts(INPUT, detect);
    expect(result).toEqual({ hasConflict: false, conflicts: [] });
  });

  it('sends the proposed event + the Shanghai-day window', async () => {
    const detect = vi.fn<[EventConflictsRequestV2], Promise<EventConflictsResponseV2>>(
      async () => ({ conflicts: [] }),
    );
    await checkDropConflicts(INPUT, detect);
    expect(detect).toHaveBeenCalledWith({
      events: [PROPOSED],
      existingWindow: { from: '2026-05-01', to: '2026-05-31' },
    });
  });

  it('returns hasConflict=true and the conflict list when the server reports conflicts', async () => {
    const conflict = {
      kind: 'event',
      sourceId: 'e9',
      startAt: '2026-05-18T01:30:00.000Z',
      endAt: '2026-05-18T02:30:00.000Z',
      title: '已排事件',
    };
    const detect = vi.fn<[EventConflictsRequestV2], Promise<EventConflictsResponseV2>>(
      async () => ({ conflicts: [conflict] }),
    );
    const result = await checkDropConflicts(INPUT, detect);
    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toEqual([conflict]);
  });

  it('re-throws when the detect request fails (NEVER coerced to "no conflict", H7)', async () => {
    const detect = vi.fn<[EventConflictsRequestV2], Promise<EventConflictsResponseV2>>(
      async () => {
        throw new Error('network down');
      },
    );
    await expect(checkDropConflicts(INPUT, detect)).rejects.toThrow(/network down/);
  });
});
