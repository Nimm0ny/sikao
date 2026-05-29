/*
 * runConflictGate tests — SIK-139 W3.
 *
 * Why: this is the H7 red-line orchestration — the three outcomes (clear /
 *      conflict / request-failure) must NEVER be conflated. These tests prove:
 *        - clear      → onClear fires, nothing else
 *        - conflict   → onConflict fires with the list, NO commit (onClear)
 *        - rejection  → onError fires, NO commit, NOT treated as "clear"
 */
import { describe, it, expect, vi } from 'vitest';

import { runConflictGate, type ConflictGateDeps } from './runConflictGate';
import type { ConflictGuardInput, ConflictGuardResult } from './conflictGuard';
import type { EventConflictItemV2, ProposedPlanEventV2 } from '@sikao/api-client/types/home';

const PROPOSED: ProposedPlanEventV2 = {
  title: '专项练习',
  category: 'practice',
  startAt: '2026-05-18T01:00:00.000Z',
  endAt: '2026-05-18T02:00:00.000Z',
  timezone: 'Asia/Shanghai',
};

const INPUT: ConflictGuardInput = {
  proposed: PROPOSED,
  window: { from: '2026-04-30T16:00:00.000Z', to: '2026-05-31T15:59:59.999Z' },
  timeZone: 'Asia/Shanghai',
};

const CONFLICT: EventConflictItemV2 = {
  kind: 'event',
  sourceId: 'e9',
  startAt: '2026-05-18T01:30:00.000Z',
  endAt: '2026-05-18T02:30:00.000Z',
  title: '已排事件',
};

function makeDeps(
  check: (input: ConflictGuardInput) => Promise<ConflictGuardResult>,
): ConflictGateDeps & {
  onClear: ReturnType<typeof vi.fn>;
  onConflict: ReturnType<typeof vi.fn>;
  onError: ReturnType<typeof vi.fn>;
} {
  return {
    check,
    onClear: vi.fn(),
    onConflict: vi.fn(),
    onError: vi.fn(),
  };
}

describe('runConflictGate', () => {
  it('clear: fires onClear only (commit proceeds)', async () => {
    const deps = makeDeps(async () => ({ hasConflict: false, conflicts: [] }));
    await runConflictGate(INPUT, deps);
    expect(deps.onClear).toHaveBeenCalledTimes(1);
    expect(deps.onConflict).not.toHaveBeenCalled();
    expect(deps.onError).not.toHaveBeenCalled();
  });

  it('conflict: opens the dialog with the list and does NOT commit', async () => {
    const deps = makeDeps(async () => ({ hasConflict: true, conflicts: [CONFLICT] }));
    await runConflictGate(INPUT, deps);
    expect(deps.onConflict).toHaveBeenCalledWith([CONFLICT]);
    expect(deps.onClear).not.toHaveBeenCalled();
    expect(deps.onError).not.toHaveBeenCalled();
  });

  it('request failure: routes to onError, does NOT commit, NOT treated as clear (H7)', async () => {
    const deps = makeDeps(async () => {
      throw new Error('network down');
    });
    await runConflictGate(INPUT, deps);
    expect(deps.onError).toHaveBeenCalledTimes(1);
    expect(deps.onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(deps.onClear).not.toHaveBeenCalled();
    expect(deps.onConflict).not.toHaveBeenCalled();
  });

  it('does not throw when the check rejects (error is contained)', async () => {
    const deps = makeDeps(async () => {
      throw new Error('boom');
    });
    await expect(runConflictGate(INPUT, deps)).resolves.toBeUndefined();
  });
});
