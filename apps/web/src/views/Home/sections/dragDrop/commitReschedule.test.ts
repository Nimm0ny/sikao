/*
 * commitReschedule tests — SIK-139 W2 (closes W2 review finding M-1).
 *
 * Why: the optimistic-write → PATCH → success-clear / reject-rollback path is
 *      the H7 fail-fast critical path and previously had no automated test
 *      (jsdom cannot drive a real dnd drop). These tests inject fake effects
 *      and assert BOTH branches: success drops the optimistic placeholder and
 *      does not notify; reject rolls the placeholder back AND surfaces an
 *      explicit error (no silent catch).
 */
import { describe, it, expect, vi } from 'vitest';

import { commitReschedule, type RescheduleCommit } from './commitReschedule';

const DECISION: RescheduleCommit = {
  eventId: 'm1',
  title: '专项练习',
  startAt: '2026-05-18T09:00:00.000Z',
  endAt: '2026-05-18T10:00:00.000Z',
};

function makeDeps(resolve: 'success' | 'error') {
  return {
    upsertOptimisticEvent: vi.fn(),
    removeOptimisticEvent: vi.fn(),
    notifyError: vi.fn(),
    mutate: vi.fn(
      (
        _vars: { eventId: string; startAt: string; endAt: string },
        callbacks: { onSuccess: () => void; onError: () => void },
      ) => {
        if (resolve === 'success') callbacks.onSuccess();
        else callbacks.onError();
      },
    ),
  };
}

describe('commitReschedule', () => {
  it('writes the optimistic patch before firing the mutation', () => {
    const deps = makeDeps('success');
    commitReschedule(DECISION, deps);
    expect(deps.upsertOptimisticEvent).toHaveBeenCalledWith('m1', {
      startAt: '2026-05-18T09:00:00.000Z',
      endAt: '2026-05-18T10:00:00.000Z',
    });
    expect(deps.mutate).toHaveBeenCalledWith(
      { eventId: 'm1', startAt: '2026-05-18T09:00:00.000Z', endAt: '2026-05-18T10:00:00.000Z' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('on success: clears the optimistic placeholder and does NOT notify', () => {
    const deps = makeDeps('success');
    commitReschedule(DECISION, deps);
    expect(deps.removeOptimisticEvent).toHaveBeenCalledWith('m1');
    expect(deps.notifyError).not.toHaveBeenCalled();
  });

  it('on reject: rolls back the optimistic patch AND surfaces an explicit error (H7)', () => {
    const deps = makeDeps('error');
    commitReschedule(DECISION, deps);
    expect(deps.removeOptimisticEvent).toHaveBeenCalledWith('m1');
    expect(deps.notifyError).toHaveBeenCalledWith('专项练习');
  });

  it('does not leave an optimistic patch behind on failure (no residue)', () => {
    const deps = makeDeps('error');
    commitReschedule(DECISION, deps);
    // upsert once (optimistic), remove once (rollback) — net zero residue.
    expect(deps.upsertOptimisticEvent).toHaveBeenCalledTimes(1);
    expect(deps.removeOptimisticEvent).toHaveBeenCalledTimes(1);
  });
});
