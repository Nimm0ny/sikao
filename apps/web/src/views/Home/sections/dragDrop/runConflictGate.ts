/*
 * runConflictGate — SIK-139 W3.
 *
 * Why: spec design "W3 Conflict Check Design" inserts a conflict gate
 *      between the W2 drop decision and `commitReschedule`. The W2 review
 *      (M-1) taught us NOT to bury orchestration inside onDragEnd where jsdom
 *      can't drive it; so the gate's three-way decision lives here as a
 *      dependency-injected async function that is unit-tested in isolation.
 *      MonthGridDnd wires real effects (checkDropConflicts / commit / dialog /
 *      toast) into the callbacks.
 *
 *      AGENT-H7 (the W3 red line — these three outcomes are NEVER conflated):
 *        - check resolves with NO conflicts → onClear()    (commit reschedule)
 *        - check resolves WITH conflicts    → onConflict()  (open confirm
 *                                             dialog; do NOT commit yet)
 *        - check REJECTS (request failed)   → onError()     (toast + do NOT
 *                                             commit; never treated as "clear")
 *      A failed request is an error routed to onError, not a "no conflict"
 *      pass-through. A non-empty conflict list is a normal business return
 *      routed to onConflict, not an error.
 */
import type { EventConflictItemV2 } from '@sikao/api-client/types/home';
import type { ConflictGuardInput, ConflictGuardResult } from './conflictGuard';

export interface ConflictGateDeps {
  /** Run the conflict pre-check (checkDropConflicts bound to the real detect). */
  readonly check: (input: ConflictGuardInput) => Promise<ConflictGuardResult>;
  /** No conflicts: proceed straight to the reschedule commit (W2 path). */
  readonly onClear: () => void;
  /** Conflicts found: open the confirm dialog with the conflict list. */
  readonly onConflict: (conflicts: readonly EventConflictItemV2[]) => void;
  /** Detect request failed: surface the error; do NOT commit (H7). */
  readonly onError: (error: Error) => void;
}

/**
 * Run the landing-conflict gate. Resolves once the branch callback has fired.
 *
 * Never throws: a rejected check is routed to `onError` (so the caller's
 * drop handler doesn't have to wrap this in its own try/catch), but it is
 * still treated as an ERROR — the commit path is not entered.
 */
export async function runConflictGate(
  input: ConflictGuardInput,
  deps: ConflictGateDeps,
): Promise<void> {
  let result: ConflictGuardResult;
  try {
    result = await deps.check(input);
  } catch (err) {
    // Request/parse failure is an error — surface it and STOP. Do not fall
    // through to onClear: a failed conflict check must never silently commit.
    deps.onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }
  if (result.hasConflict) {
    deps.onConflict(result.conflicts);
    return;
  }
  deps.onClear();
}
