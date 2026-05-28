/*
 * calendarViewConfig/errors.ts — SIK-138 W2.
 *
 * Why: requirements.md Requirement 2 demands fail-fast factory behavior
 *      with four named errors. AGENT-H7 forbids silent fallback or
 *      `?? defaultValue` patterns when invalid configuration is provided.
 *      Mirror the `homeStream.ts` pattern: `class XxxError extends Error`
 *      with an explicit `name` and structured payload fields callers can
 *      inspect (e.g. logging, tests).
 */

/** Thrown when a non-`CalendarView` literal is supplied. */
export class InvalidCalendarViewError extends Error {
  readonly value: unknown;

  constructor(value: unknown) {
    super(
      `calendarViewConfig: invalid view ${JSON.stringify(value)}; ` +
        `expected one of "today" | "week" | "month"`,
    );
    this.name = 'InvalidCalendarViewError';
    this.value = value;
  }
}

/**
 * Thrown when `cardLimitPerCell` is not a finite positive integer
 * (or `Number.MAX_SAFE_INTEGER`, which Today / Week use as "no limit").
 */
export class InvalidCalendarLimitError extends Error {
  readonly value: unknown;

  constructor(value: unknown) {
    super(
      `calendarViewConfig: invalid cardLimitPerCell ${JSON.stringify(value)}; ` +
        `expected a positive integer or Number.MAX_SAFE_INTEGER`,
    );
    this.name = 'InvalidCalendarLimitError';
    this.value = value;
  }
}

/** Thrown when an unknown property name is supplied to the factory or registry. */
export class UnknownCalendarPropertyError extends Error {
  readonly value: unknown;

  constructor(value: unknown) {
    super(
      `calendarViewConfig: unknown CalendarCardProperty ${JSON.stringify(value)}; ` +
        `allowed values are title, category, kind, status, source, linkedSession, target`,
    );
    this.name = 'UnknownCalendarPropertyError';
    this.value = value;
  }
}

/** Thrown when a preset key outside the locked three is requested. */
export class UnknownCalendarPresetError extends Error {
  readonly value: unknown;

  constructor(value: unknown) {
    super(
      `calendarViewConfig: unknown CalendarDensityPreset ${JSON.stringify(value)}; ` +
        `expected one of "compact" | "default" | "detail"`,
    );
    this.name = 'UnknownCalendarPresetError';
    this.value = value;
  }
}
