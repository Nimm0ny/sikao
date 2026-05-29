/*
 * rescheduleEvent — SIK-139 W2.
 *
 * Why: plan §4.3 + requirements Requirement 4 lock the drop math. Dragging a
 *      chip from the day it is shown on (`fromDay`) to a target day
 *      (`toDay`) shifts the whole event by that many WHOLE days, preserving
 *      the original time-of-day, duration, and timezone offset. This is the
 *      "grab the slice you see, move it to the target cell" semantic: a
 *      cross-day event grabbed on its continuation slice still shifts by the
 *      grabbed→target delta (Requirement 4 anchor rule).
 *
 *      AGENT-H7: invalid input throws — no silent `?? original` fallback.
 *      A same-day drop is the caller's no-op concern (Requirement 4); this
 *      function still returns the unchanged pair for delta=0 so callers can
 *      compare and skip the request without a special case.
 *
 *      Timezone note (explicit, not a silent assumption): the app runs a
 *      single timezone (Asia/Shanghai, no DST), so a whole-day shift in UTC
 *      minutes preserves the local wall-clock time exactly. Cross-DST
 *      correctness is out of scope for this single-tz app; if a DST-bearing
 *      timezone is ever introduced, this whole-day-minutes shift must be
 *      revisited (it could drift by the DST offset).
 */
import { addMinutesToIso } from '@sikao/calendar-engine';

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MINUTES_PER_DAY = 24 * 60;

export interface ReschedulableEvent {
  readonly startAt: string;
  readonly endAt: string;
}

export interface RescheduleResult {
  readonly startAt: string;
  readonly endAt: string;
}

/** Whole-day delta between two `YYYY-MM-DD` stamps (toDay - fromDay). */
function dayDelta(fromDay: string, toDay: string): number {
  const fromUtc = Date.parse(`${fromDay}T00:00:00.000Z`);
  const toUtc = Date.parse(`${toDay}T00:00:00.000Z`);
  // Both parses are guarded by ISO_DAY_RE + Number.isNaN below; a NaN here
  // means an out-of-range calendar date slipped past the regex.
  if (Number.isNaN(fromUtc) || Number.isNaN(toUtc)) {
    throw new Error(`rescheduleEvent: unparseable day stamp (from=${fromDay}, to=${toDay})`);
  }
  return Math.round((toUtc - fromUtc) / (MINUTES_PER_DAY * 60 * 1000));
}

/**
 * Shift an event's `startAt` / `endAt` by the whole-day delta from `fromDay`
 * to `toDay`. Returns ISO strings. Throws on malformed input (AGENT-H7).
 *
 * @param event   the source event time pair (real `startAt` / `endAt`)
 * @param fromDay the `YYYY-MM-DD` the dragged chip was shown on (slice.day)
 * @param toDay   the `YYYY-MM-DD` drop-target cell stamp
 */
export function rescheduleEvent(
  event: ReschedulableEvent,
  fromDay: string,
  toDay: string,
): RescheduleResult {
  if (!ISO_DAY_RE.test(fromDay) || !ISO_DAY_RE.test(toDay)) {
    throw new Error(`rescheduleEvent: day stamps must be YYYY-MM-DD (from=${fromDay}, to=${toDay})`);
  }
  if (Number.isNaN(Date.parse(event.startAt)) || Number.isNaN(Date.parse(event.endAt))) {
    throw new Error(
      `rescheduleEvent: event has unparseable startAt/endAt (startAt=${event.startAt}, endAt=${event.endAt})`,
    );
  }
  const deltaMinutes = dayDelta(fromDay, toDay) * MINUTES_PER_DAY;
  return {
    startAt: addMinutesToIso(event.startAt, deltaMinutes),
    endAt: addMinutesToIso(event.endAt, deltaMinutes),
  };
}
