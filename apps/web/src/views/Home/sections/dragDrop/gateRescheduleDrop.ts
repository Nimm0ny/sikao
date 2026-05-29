/*
 * gateRescheduleDrop — SIK-139 W4 (closes W3 review F-3).
 *
 * Why: W3 review (docs/reviews/sik-139-w3.md, F-3) flagged that the gate
 *      WIRING — turning a resolved reschedule decision into a proposed event,
 *      running the conflict gate, and routing the three outcomes to commit /
 *      dialog / toast — had only the unit-level `runConflictGate` test, no
 *      higher integration. jsdom can't drive a real dnd drop (collision needs
 *      layout) so, exactly as W2 extracted `commitReschedule` and W3 extracted
 *      `runConflictGate`, this extracts the decision→gate→branch seam from
 *      MonthGridDnd.onDragEnd so it is unit-testable end to end. The component
 *      keeps the dnd plumbing (resolveCalendarDrop + the malformed-time throw,
 *      already covered) and calls this for the post-decision orchestration.
 *
 *      AGENT-H7: this does NOT introduce a second commit path. It binds the
 *      SAME pieces the W2/W3 component used — buildProposedEvent +
 *      runConflictGate (clear→onCommit / conflict→onConflict / error→onError).
 *      The three outcomes stay strictly apart; a failed detect never commits.
 */
import type { EventConflictItemV2 } from '@sikao/api-client/types/home';

import { buildProposedEvent } from './proposedEvent';
import { checkDropConflicts, type ConflictGuardInput, type ConflictGuardResult, type ConflictWindow } from './conflictGuard';
import { runConflictGate } from './runConflictGate';
import type { CalendarDropDecision, DropDragData } from './resolveCalendarDrop';

/** The reschedule branch of a resolved drop decision. */
export type RescheduleDecision = Extract<CalendarDropDecision, { kind: 'reschedule' }>;

/** Render context the gate needs (the month view window + calendar zone). */
export interface DropGateContext {
  readonly window: ConflictWindow;
  readonly timeZone: string;
}

/** Injected effects so the orchestration stays unit-testable. */
export interface DropGateDeps {
  /** Conflict pre-check (defaults to the real network-bound checkDropConflicts). */
  readonly check?: (input: ConflictGuardInput) => Promise<ConflictGuardResult>;
  /** No conflicts: proceed to the reschedule commit (W2 path). */
  readonly onCommit: (decision: RescheduleDecision) => void;
  /** Conflicts found: hold the decision + open the confirm dialog. */
  readonly onConflict: (
    decision: RescheduleDecision,
    conflicts: readonly EventConflictItemV2[],
  ) => void;
  /** Detect request failed: surface it; do NOT commit (H7). */
  readonly onError: (error: Error) => void;
}

/**
 * Gate a resolved reschedule decision: build the proposed (shifted) event,
 * run the landing-conflict pre-check, and route the outcome to commit /
 * dialog / error. Reuses the dragged event's descriptive fields off the drag
 * data (the gate only changes the times).
 *
 * Resolves once the branch callback has fired; never throws (a rejected check
 * is routed to `onError` by `runConflictGate`).
 */
export async function gateRescheduleDrop(
  decision: RescheduleDecision,
  data: DropDragData,
  ctx: DropGateContext,
  deps: DropGateDeps,
): Promise<void> {
  const proposed = buildProposedEvent(
    {
      title: data.title,
      category: data.category ?? '',
      timezone: data.timezone,
      recurringRule: data.recurringRule,
    },
    { startAt: decision.startAt, endAt: decision.endAt },
    ctx.timeZone,
  );
  await runConflictGate(
    { proposed, window: ctx.window, timeZone: ctx.timeZone },
    {
      check: deps.check ?? ((input) => checkDropConflicts(input)),
      onClear: () => deps.onCommit(decision),
      onConflict: (conflicts) => deps.onConflict(decision, conflicts),
      onError: (error) => deps.onError(error),
    },
  );
}
