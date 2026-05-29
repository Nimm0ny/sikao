/*
 * gateRescheduleDrop tests — SIK-139 W4 (closes W3 review F-3).
 *
 * Why: F-3 asked for integration coverage of the gate WIRING above the
 *      `runConflictGate` unit level — i.e. that a resolved reschedule
 *      decision is turned into the right proposed event and routed to the
 *      correct branch (commit / dialog / error) with the SAME pieces the
 *      component used (no second commit path). These tests drive the seam
 *      with an injected `check` so no network is hit, and assert:
 *        - clear      → onCommit fires with the decision, nothing else
 *        - conflict   → onConflict fires with (decision, list), NO commit
 *        - failure    → onError fires, NO commit (H7)
 *        - the proposed event the gate checks carries the SHIFTED times +
 *          the dragged event's descriptive fields (title/category/tz).
 */
import { describe, it, expect, vi } from 'vitest';

import { gateRescheduleDrop, type RescheduleDecision } from './gateRescheduleDrop';
import type { DropDragData } from './resolveCalendarDrop';
import type { ConflictGuardInput, ConflictGuardResult } from './conflictGuard';
import type { EventConflictItemV2 } from '@sikao/api-client/types/home';

const DECISION: RescheduleDecision = {
  kind: 'reschedule',
  eventId: 'm1',
  title: '行测套卷模考',
  startAt: '2026-05-30T01:00:00.000Z',
  endAt: '2026-05-30T03:00:00.000Z',
};

const DATA: DropDragData = {
  eventId: 'm1',
  fromDay: '2026-05-15',
  startAt: '2026-05-15T01:00:00.000Z',
  endAt: '2026-05-15T03:00:00.000Z',
  title: '行测套卷模考',
  category: 'mock',
  timezone: 'Asia/Shanghai',
  recurringRule: null,
};

const CTX = {
  window: { from: '2026-04-30T16:00:00.000Z', to: '2026-05-31T15:59:59.999Z' },
  timeZone: 'Asia/Shanghai',
};

const CONFLICT: EventConflictItemV2 = {
  kind: 'event',
  sourceId: 'e9',
  startAt: '2026-05-30T01:30:00.000Z',
  endAt: '2026-05-30T02:30:00.000Z',
  title: '已排事件',
};

function deps(check: (i: ConflictGuardInput) => Promise<ConflictGuardResult>) {
  return {
    check,
    onCommit: vi.fn(),
    onConflict: vi.fn(),
    onError: vi.fn(),
  };
}

describe('gateRescheduleDrop (SIK-139 W4 F-3 — gate wiring integration)', () => {
  it('clear: commits with the decision, no dialog, no error', async () => {
    const d = deps(async () => ({ hasConflict: false, conflicts: [] }));
    await gateRescheduleDrop(DECISION, DATA, CTX, d);
    expect(d.onCommit).toHaveBeenCalledWith(DECISION);
    expect(d.onConflict).not.toHaveBeenCalled();
    expect(d.onError).not.toHaveBeenCalled();
  });

  it('conflict: holds the decision + opens the dialog, does NOT commit', async () => {
    const d = deps(async () => ({ hasConflict: true, conflicts: [CONFLICT] }));
    await gateRescheduleDrop(DECISION, DATA, CTX, d);
    expect(d.onConflict).toHaveBeenCalledWith(DECISION, [CONFLICT]);
    expect(d.onCommit).not.toHaveBeenCalled();
    expect(d.onError).not.toHaveBeenCalled();
  });

  it('detect failure: routes to onError, does NOT commit (H7)', async () => {
    const d = deps(async () => {
      throw new Error('network down');
    });
    await gateRescheduleDrop(DECISION, DATA, CTX, d);
    expect(d.onError).toHaveBeenCalledTimes(1);
    expect(d.onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(d.onCommit).not.toHaveBeenCalled();
    expect(d.onConflict).not.toHaveBeenCalled();
  });

  it('checks a proposed event with the SHIFTED times + dragged descriptive fields', async () => {
    let seen: ConflictGuardInput | null = null;
    const d = deps(async (input) => {
      seen = input;
      return { hasConflict: false, conflicts: [] };
    });
    await gateRescheduleDrop(DECISION, DATA, CTX, d);
    expect(seen).not.toBeNull();
    const input = seen as unknown as ConflictGuardInput;
    // shifted times come from the decision (post-reschedule)…
    expect(input.proposed.startAt).toBe(DECISION.startAt);
    expect(input.proposed.endAt).toBe(DECISION.endAt);
    // …descriptive fields come from the dragged event (unchanged).
    expect(input.proposed.title).toBe('行测套卷模考');
    expect(input.proposed.category).toBe('mock');
    expect(input.proposed.timezone).toBe('Asia/Shanghai');
    expect(input.window).toEqual(CTX.window);
  });
});
