/*
 * resolveCalendarDrop — SIK-139 W2.
 *
 * Why: dnd-kit's `onDragEnd` is awkward to drive deterministically in jsdom
 *      (real collision detection needs layout). To keep the drop DECISION
 *      unit-testable in isolation, the component delegates the "what should
 *      happen on this drop" question to this pure resolver, then performs the
 *      resulting side effect (optimistic write + PATCH) itself. The resolver
 *      owns Requirement 4 / Requirement 6 branch logic; the component owns the
 *      store + network effects.
 *
 *      AGENT-H7: every branch is explicit. A malformed payload returns a
 *      `'cancel'` decision (the drop simply does nothing) rather than a
 *      silent guess; the actual reschedule math (rescheduleEvent) still
 *      throws on malformed times — that throw is handled at the call site
 *      with a toast, not here, because this resolver stays pure (no I/O).
 */
import { rescheduleEvent } from './rescheduleEvent';

/** Minimal shape pulled off the dnd `active.data.current`. */
export interface DropDragData {
  readonly eventId: string;
  readonly fromDay: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly title: string;
  // SIK-139 W3: descriptive fields the conflict pre-check needs to build the
  // proposed (shifted) event for `detectEventConflicts`. Optional so the W2
  // decision logic + tests are unchanged; the gate reads them off the drag
  // data alongside the shifted times.
  readonly category?: string;
  readonly timezone?: string | null;
  readonly recurringRule?: string | null;
}

export type CalendarDropDecision =
  | { readonly kind: 'cancel' }
  | { readonly kind: 'noop' }
  | {
      readonly kind: 'reschedule';
      readonly eventId: string;
      readonly title: string;
      readonly startAt: string;
      readonly endAt: string;
    };

/**
 * Decide what a drop should do.
 *
 * @param data  the dragged chip's data (from `active.data.current`), or null
 * @param overId the droppable id under the pointer at drop (cell stamp), or null
 *
 * - `over == null`            → `cancel` (dropped outside any day cell)
 * - missing/!data             → `cancel` (defensive)
 * - `toDay === fromDay`       → `noop` (same day, no request)
 * - otherwise                 → `reschedule` with the shifted times
 *
 * Throws only if `rescheduleEvent` throws (malformed times); the caller
 * catches that to surface a toast (Requirement 6).
 */
export function resolveCalendarDrop(
  data: DropDragData | null | undefined,
  overId: string | null | undefined,
): CalendarDropDecision {
  if (overId == null || data == null) {
    return { kind: 'cancel' };
  }
  if (overId === data.fromDay) {
    return { kind: 'noop' };
  }
  const next = rescheduleEvent(
    { startAt: data.startAt, endAt: data.endAt },
    data.fromDay,
    overId,
  );
  return {
    kind: 'reschedule',
    eventId: data.eventId,
    title: data.title,
    startAt: next.startAt,
    endAt: next.endAt,
  };
}
