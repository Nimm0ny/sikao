import { rrulestr } from 'rrule';

import type {
  CalendarEventInput,
  CalendarOccurrence,
  CalendarWindow,
  DetachedOccurrenceOverride,
} from './types';
import { differenceInCalendarMinutes, toLocalDateStamp } from './timezone';

function buildOccurrenceRef(sourceId: string, startAt: Date, timeZone: string): string {
  return `${sourceId}:${toLocalDateStamp(startAt, timeZone)}`;
}

function shouldSkipOccurrence(
  occurrenceRef: string,
  event: CalendarEventInput,
): boolean {
  const occurrenceDay = occurrenceRef.split(':', 2)[1];
  if (occurrenceDay && event.recurringExceptionDates?.includes(occurrenceDay)) {
    return true;
  }
  const detached = event.detachedOccurrences?.[occurrenceRef];
  return detached?.startAt === null || detached?.endAt === null;
}

function applyDetachedOverride(
  override: DetachedOccurrenceOverride | undefined,
  occurrence: CalendarOccurrence,
): CalendarOccurrence {
  if (override === undefined) return occurrence;
  return {
    ...occurrence,
    startAt: override.startAt ?? occurrence.startAt,
    endAt: override.endAt ?? occurrence.endAt,
    isDetached: true,
  };
}

function overlapsWindow(startAt: Date, endAt: Date, window: CalendarWindow): boolean {
  const windowStart = new Date(window.from);
  const windowEnd = new Date(window.to);
  return startAt <= windowEnd && endAt >= windowStart;
}

export function expandRecurringOccurrences(
  event: CalendarEventInput,
  window: CalendarWindow,
): CalendarOccurrence[] {
  const baseStart = new Date(event.startAt);
  const durationMinutes = differenceInCalendarMinutes(event.startAt, event.endAt);
  const durationMs = durationMinutes * 60 * 1000;

  if (!event.recurringRule) {
    const baseOccurrence: CalendarOccurrence = {
      id: event.id,
      sourceId: event.id,
      occurrenceRef: buildOccurrenceRef(event.id, baseStart, event.timeZone),
      startAt: event.startAt,
      endAt: event.endAt,
      timeZone: event.timeZone,
      isDetached: false,
    };
    return overlapsWindow(baseStart, new Date(event.endAt), window) ? [baseOccurrence] : [];
  }

  const schedule = rrulestr(event.recurringRule, { dtstart: baseStart });
  const windowStart = new Date(window.from);
  const windowEnd = new Date(window.to);
  const expandedWindowStart = new Date(windowStart.getTime() - Math.max(durationMs, 0));
  const starts = schedule.between(expandedWindowStart, windowEnd, true);

  return starts
    .map((startAt) => {
      const occurrenceRef = buildOccurrenceRef(event.id, startAt, event.timeZone);
      if (shouldSkipOccurrence(occurrenceRef, event)) {
        return null;
      }
      const occurrence: CalendarOccurrence = {
        id: occurrenceRef,
        sourceId: event.id,
        occurrenceRef,
        startAt: startAt.toISOString(),
        endAt: new Date(startAt.getTime() + durationMs).toISOString(),
        timeZone: event.timeZone,
        isDetached: false,
      };
      const resolvedOccurrence = applyDetachedOverride(
        event.detachedOccurrences?.[occurrenceRef],
        occurrence,
      );
      return overlapsWindow(
        new Date(resolvedOccurrence.startAt),
        new Date(resolvedOccurrence.endAt),
        window,
      )
        ? resolvedOccurrence
        : null;
    })
    .filter((occurrence): occurrence is CalendarOccurrence => occurrence !== null);
}
