import type { CalendarOccurrence, CalendarWindow, CrossDaySlice, DashboardCalendarView, ViewRangeAnchor } from './types';
import { addMinutesToIso, differenceInCalendarMinutes, endOfLocalDay, startOfLocalDay, toLocalDateStamp } from './timezone';

function parseIsoDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function formatUtcDay(day: Date): string {
  return day.toISOString().slice(0, 10);
}

function addUtcDays(day: Date, delta: number): Date {
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

export function buildViewRange(
  view: DashboardCalendarView,
  anchor: ViewRangeAnchor,
): CalendarWindow {
  const anchorDate = parseIsoDay(anchor.anchorDate);

  if (view === 'today') {
    return {
      from: startOfLocalDay(anchor.anchorDate, anchor.timeZone).toISOString(),
      to: endOfLocalDay(anchor.anchorDate, anchor.timeZone).toISOString(),
    };
  }

  if (view === 'week') {
    const weekday = anchorDate.getUTCDay();
    const weekOffset = (weekday + 6) % 7;
    const weekStartDay = addUtcDays(anchorDate, -weekOffset);
    const weekEndDay = addUtcDays(weekStartDay, 6);
    return {
      from: startOfLocalDay(formatUtcDay(weekStartDay), anchor.timeZone).toISOString(),
      to: endOfLocalDay(formatUtcDay(weekEndDay), anchor.timeZone).toISOString(),
    };
  }

  const monthStartDay = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), 1));
  const monthEndDay = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + 1, 0));
  return {
    from: startOfLocalDay(formatUtcDay(monthStartDay), anchor.timeZone).toISOString(),
    to: endOfLocalDay(formatUtcDay(monthEndDay), anchor.timeZone).toISOString(),
  };
}

export function snapMinutes(
  valueMinutes: number,
  stepMinutes = 15,
): number {
  return Math.round(valueMinutes / stepMinutes) * stepMinutes;
}

export function shiftOccurrenceByMinutes(
  occurrence: Pick<CalendarOccurrence, 'startAt' | 'endAt'>,
  deltaMinutes: number,
  stepMinutes = 15,
): { startAt: string; endAt: string } {
  const snapped = snapMinutes(deltaMinutes, stepMinutes);
  return {
    startAt: addMinutesToIso(occurrence.startAt, snapped),
    endAt: addMinutesToIso(occurrence.endAt, snapped),
  };
}

export function sliceOccurrenceByDay(
  occurrence: CalendarOccurrence,
): CrossDaySlice[] {
  const slices: CrossDaySlice[] = [];
  const start = new Date(occurrence.startAt);
  const end = new Date(occurrence.endAt);
  const durationMinutes = differenceInCalendarMinutes(occurrence.startAt, occurrence.endAt);

  if (durationMinutes <= 0) return slices;

  let cursorDay = toLocalDateStamp(start, occurrence.timeZone);
  const endDay = toLocalDateStamp(end, occurrence.timeZone);

  for (;;) {
    const dayStart = startOfLocalDay(cursorDay, occurrence.timeZone);
    const dayEnd = endOfLocalDay(cursorDay, occurrence.timeZone);
    const sliceStart = new Date(Math.max(dayStart.getTime(), start.getTime()));
    const sliceEnd = new Date(Math.min(dayEnd.getTime(), end.getTime()));

    if (sliceEnd > sliceStart) {
      slices.push({
        occurrenceRef: occurrence.occurrenceRef,
        day: cursorDay,
        sliceStartAt: sliceStart.toISOString(),
        sliceEndAt: sliceEnd.toISOString(),
        isStartSlice: cursorDay === toLocalDateStamp(start, occurrence.timeZone),
        isEndSlice: cursorDay === endDay,
      });
    }

    if (cursorDay === endDay) break;
    cursorDay = formatUtcDay(addUtcDays(parseIsoDay(cursorDay), 1));
  }

  return slices;
}
