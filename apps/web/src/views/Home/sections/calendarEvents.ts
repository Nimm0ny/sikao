/*
 * calendarEvents.ts — SIK-138 W4.5.
 *
 * Why: requirements.md Requirement 10 + design.md D16 / D17 require all
 *      three Home calendar views to integrate `expandRecurringOccurrences`
 *      and the month view to integrate `sliceOccurrenceByDay`. This module
 *      is the projection layer between `PlanEventReadV2` (the API DTO) and
 *      the Home view layer.
 *
 *      AGENT-H7 note: a missing `recurringRule` is the documented "single
 *      occurrence" path, not a silent fallback. The engine helpers handle
 *      the case explicitly; we still call them so the projection stays
 *      uniform.
 *
 *      AGENT-H6 (Define-First): occurrences are returned bundled with
 *      their source event so chip renderers (today / week / month) can
 *      stay declarative. The bundle is the single shape every Home view
 *      consumes; do not unpack `occurrence.startAt` from a different
 *      source than the engine produces.
 */

import {
  expandRecurringOccurrences,
  sliceOccurrenceByDay,
  type CalendarEventInput,
  type CalendarOccurrence,
  type CalendarWindow,
  type CrossDaySlice,
} from '@sikao/calendar-engine';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

/**
 * Bundle of an expanded occurrence and its source event. Today / Week /
 * Month chip renderers receive this so they can read `event.title`,
 * `event.category` etc. while the geometry is driven by `occurrence.*`.
 */
export interface EnrichedOccurrence {
  readonly occurrence: CalendarOccurrence;
  readonly event: PlanEventReadV2;
}

/** Map a `PlanEventReadV2` row to the engine's `CalendarEventInput`. */
export function eventToCalendarInput(event: PlanEventReadV2): CalendarEventInput {
  return {
    id: event.id,
    startAt: event.startAt,
    endAt: event.endAt,
    timeZone: event.timezone,
    recurringRule: event.recurringRule ?? null,
    recurringExceptionDates: event.recurringExceptionDates ?? [],
    // V1 has no detachedOccurrences API surface; the engine's optional
    // field is intentionally left unset.
  };
}

/**
 * Expand every event into 0..N occurrences clipped to `window`. The
 * returned list is in engine-emitted order (sorted by source event then
 * by occurrence start). Callers that need a different ordering (e.g.
 * chronological across all events) must sort downstream.
 */
export function expandPlanEventsForView(
  events: ReadonlyArray<PlanEventReadV2>,
  window: CalendarWindow,
): EnrichedOccurrence[] {
  const enriched: EnrichedOccurrence[] = [];
  for (const event of events) {
    const occurrences = expandRecurringOccurrences(eventToCalendarInput(event), window);
    for (const occurrence of occurrences) {
      enriched.push({ occurrence, event });
    }
  }
  return enriched;
}

/**
 * Slice month occurrences by day so cross-day events render in every cell
 * they touch. Returns one row per (occurrence, day-touched) pair, with
 * the source event bundled for chip rendering.
 */
export interface MonthDaySlice {
  readonly slice: CrossDaySlice;
  readonly event: PlanEventReadV2;
}

export function sliceMonthOccurrencesByDay(
  enriched: ReadonlyArray<EnrichedOccurrence>,
): MonthDaySlice[] {
  const out: MonthDaySlice[] = [];
  for (const { occurrence, event } of enriched) {
    for (const slice of sliceOccurrenceByDay(occurrence)) {
      out.push({ slice, event });
    }
  }
  return out;
}
