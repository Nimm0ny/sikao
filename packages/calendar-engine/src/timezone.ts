import { differenceInMinutes } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

const LOCAL_DATE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getLocalDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = LOCAL_DATE_FORMATTER_CACHE.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  LOCAL_DATE_FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

export function toLocalDateStamp(value: Date | string, timeZone: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return getLocalDateFormatter(timeZone).format(date);
}

export function startOfLocalDay(day: string, timeZone: string): Date {
  return fromZonedTime(`${day}T00:00:00`, timeZone);
}

function nextIsoDay(day: string): string {
  const next = new Date(`${day}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function endOfLocalDay(day: string, timeZone: string): Date {
  return fromZonedTime(`${nextIsoDay(day)}T00:00:00`, timeZone);
}

export function addMinutesToIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
}

export function differenceInCalendarMinutes(startAt: string, endAt: string): number {
  return differenceInMinutes(new Date(endAt), new Date(startAt));
}

export function fromLocalDateTime(
  day: string,
  time: string,
  timeZone: string,
): Date {
  return fromZonedTime(`${day}T${time}:00`, timeZone);
}
