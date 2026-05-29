/*
 * zonedDateKey — map a UTC/ISO instant to its calendar day (YYYY-MM-DD) in a
 * given IANA time zone, throwing on an unparseable instant.
 *
 * Why this is shared (SIK-142 W1, contract §5 C9):
 *   The Home calendar has TWO local-day helpers with different failure
 *   semantics:
 *     - `@sikao/calendar-engine` `toLocalDateStamp` — formats only; an
 *       invalid date silently yields "Invalid Date" (NO throw).
 *     - this `zonedDateKey` — fail-fast: an unparseable instant THROWS
 *       (AGENT-H7, no silent fallback to "today" / the raw string).
 *
 *   `deriveChipTone` (chip time-status color) compares occurrence local days
 *   and MUST fail fast on bad timestamps, and `conflictGuard` (SIK-139, the
 *   landing-conflict pre-check) needs the same Shanghai-day window mapping.
 *   Rather than keep two app-layer copies, the throwing variant is promoted
 *   here so both consume one source. `conflictGuard` re-exports it for its
 *   existing call sites / tests.
 *
 *   `en-CA` formats as ISO-ordered `YYYY-MM-DD`, so the result is directly
 *   comparable as a string and matches the server's date-window contract.
 */

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = FORMATTER_CACHE.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

/**
 * Map an ISO instant to its `YYYY-MM-DD` calendar day in `timeZone`.
 *
 * @throws if `iso` is not a parseable instant (AGENT-H7 — never silently
 *         coerced to "today" or the raw input).
 */
export function zonedDateKey(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`zonedDateKey: unparseable instant "${iso}"`);
  }
  return getFormatter(timeZone).format(date);
}
