/*
 * buildProposedEvent — SIK-139 W3.
 *
 * Why: the conflict check (Requirement 7) asks the server whether the
 *      already-shifted event would collide. The server's
 *      `ProposedPlanEventV2` wants the POST-reschedule `startAt` / `endAt`
 *      (from `rescheduleEvent`) but the unchanged `title` / `category` /
 *      `timezone` / `recurringRule` of the dragged event. This pure builder
 *      assembles that shape so the gate orchestration (runConflictGate) and
 *      MonthGridDnd stay free of field-shuffling logic and the mapping is
 *      unit-tested in isolation.
 *
 *      AGENT-H7: a recurring event keeps its `recurringRule` so the server
 *      expands occurrences for the conflict scan; we do NOT fabricate or drop
 *      it. `timezone` falls back to the calendar zone only when the dragged
 *      event carries none (defensive default for the wire contract's required
 *      field, not a silent business fallback).
 */
import type { ProposedPlanEventV2 } from '@sikao/api-client/types/home';

/** The dragged event fields needed to describe the proposed (shifted) event. */
export interface ProposedEventSource {
  readonly title: string;
  readonly category: string;
  readonly timezone?: string | null;
  readonly recurringRule?: string | null;
}

/** The shifted times produced by `rescheduleEvent` (post-drop). */
export interface ProposedEventTimes {
  readonly startAt: string;
  readonly endAt: string;
}

/**
 * Assemble the `ProposedPlanEventV2` sent to `detectEventConflicts`:
 * shifted times from the drop, descriptive fields from the dragged event.
 */
export function buildProposedEvent(
  source: ProposedEventSource,
  times: ProposedEventTimes,
  fallbackTimeZone: string,
): ProposedPlanEventV2 {
  const proposed: ProposedPlanEventV2 = {
    title: source.title,
    category: source.category,
    startAt: times.startAt,
    endAt: times.endAt,
    timezone: source.timezone ?? fallbackTimeZone,
  };
  if (source.recurringRule != null && source.recurringRule !== '') {
    return { ...proposed, recurringRule: source.recurringRule };
  }
  return proposed;
}
