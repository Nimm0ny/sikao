/*
 * peek/types.ts — SIK-138 W6.
 *
 * Why: the read-only Peek card has a tight state machine:
 *        - opened against an event AND a list (the chip list it was
 *          launched from)
 *        - prev / next walk inside that list scope only
 *        - close releases focus + body scroll lock
 *      Types live here so provider / hook / card share the same shape.
 *
 *      AGENT-H6 / Define-First: list is required at open() time. Peek
 *      open() must throw if the list is empty or if the event is not
 *      found in the list — silent fallback would mask a wiring bug.
 */

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

/**
 * Snapshot of the state the consumer (chip click handler) hands to the
 * peek. The list is the chronological list the chip belongs to (e.g. the
 * three chips visible on the same day cell, or all chips in the month
 * view); prev / next walk this list and never reach outside it.
 */
export interface CalendarPeekListEntry {
  readonly id: string;
  readonly event: PlanEventReadV2;
}

export interface CalendarPeekContextValue {
  readonly open: (event: PlanEventReadV2, list: ReadonlyArray<CalendarPeekListEntry>) => void;
  readonly close: () => void;
  readonly next: () => void;
  readonly prev: () => void;
  readonly isOpen: boolean;
  readonly currentEvent: PlanEventReadV2 | null;
  readonly currentIndex: number;
  readonly listLength: number;
}
