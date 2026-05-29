/*
 * conflictGuard — SIK-139 W3.
 *
 * Why: spec design "W3 Conflict Check Design" inserts a landing-conflict
 *      pre-check (Requirement 7) between the W2 drop decision and the actual
 *      reschedule commit. This module is the thin network wrapper around the
 *      EXISTING `detectEventConflicts` (`POST /plans/events/conflicts`) — no
 *      new endpoint (Requirement 1). It takes the proposed (already-shifted)
 *      event plus the month view window, asks the server for conflicts, and
 *      returns `{ hasConflict, conflicts }`.
 *
 *      AGENT-H7 (the most sensitive line in W3): a FAILED request is an
 *      error and is re-thrown here — never swallowed, never coerced into
 *      "no conflict". A SUCCESSFUL response carrying conflicts is a normal
 *      business return (the caller routes it into the confirm dialog). The
 *      two are kept strictly apart: this function only throws on transport /
 *      parse failure; a non-empty `conflicts` array returns normally.
 *
 *      H6 boundary note: the server's `ExistingWindowV2` expects calendar
 *      DATE strings (YYYY-MM-DD, interpreted in Asia/Shanghai), but
 *      `buildViewRange` hands us ISO datetimes in UTC. `zonedDateKey` maps
 *      the UTC instant back to its Asia/Shanghai calendar day so the window
 *      matches what the month grid actually shows (a UTC slice would be off
 *      by one day across the +08:00 boundary).
 *
 *      SIK-142 W1 (contract §5 C9): `zonedDateKey` was promoted to
 *      `@sikao/shared-utils` so the chip tone derivation can reuse the same
 *      fail-fast (throwing) local-day mapping. It is re-exported here so this
 *      module's existing call sites and `conflictGuard.test.ts` are unchanged.
 */
import { detectEventConflicts } from '@sikao/api-client/plansQueries';
import { zonedDateKey } from '@sikao/shared-utils';
import type {
  EventConflictItemV2,
  EventConflictsRequestV2,
  EventConflictsResponseV2,
  ProposedPlanEventV2,
} from '@sikao/api-client/types/home';

/**
 * Re-export the shared fail-fast local-day mapper. SIK-142 W1 moved the
 * implementation to `@sikao/shared-utils`; this alias keeps the W3 import
 * surface (`import { zonedDateKey } from './conflictGuard'`) and its tests
 * intact.
 */
export { zonedDateKey };

/** ISO-datetime window as produced by `buildViewRange` (UTC instants). */
export interface ConflictWindow {
  readonly from: string;
  readonly to: string;
}

export interface ConflictGuardInput {
  /** The already-shifted proposed event (post-reschedule). */
  readonly proposed: ProposedPlanEventV2;
  /** The month view window (ISO datetimes from `buildViewRange`). */
  readonly window: ConflictWindow;
  /** IANA zone the calendar renders in (Asia/Shanghai). */
  readonly timeZone: string;
}

export interface ConflictGuardResult {
  readonly hasConflict: boolean;
  readonly conflicts: readonly EventConflictItemV2[];
}

/** Detect function shape (injectable so tests don't hit the network). */
export type DetectConflictsFn = (
  payload: EventConflictsRequestV2,
) => Promise<EventConflictsResponseV2>;

/**
 * Ask the server whether the proposed (shifted) event conflicts with any
 * existing event / practice block in the window.
 *
 * @throws if the detect request itself fails (transport / parse). The caller
 *         MUST treat that as an error (toast + do not commit), NOT as "no
 *         conflict" (AGENT-H7 / design Decisions 1).
 */
export async function checkDropConflicts(
  input: ConflictGuardInput,
  detect: DetectConflictsFn = detectEventConflicts,
): Promise<ConflictGuardResult> {
  const response = await detect({
    events: [input.proposed],
    existingWindow: {
      from: zonedDateKey(input.window.from, input.timeZone),
      to: zonedDateKey(input.window.to, input.timeZone),
    },
  });
  const conflicts = response.conflicts ?? [];
  return { hasConflict: conflicts.length > 0, conflicts };
}
