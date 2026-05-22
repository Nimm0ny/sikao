export interface CalendarWindow {
  readonly from: string;
  readonly to: string;
}

export interface CalendarEventInput {
  readonly id: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly timeZone: string;
  readonly recurringRule?: string | null;
  readonly recurringExceptionDates?: readonly string[];
  readonly detachedOccurrences?: Readonly<Record<string, DetachedOccurrenceOverride>>;
}

export interface DetachedOccurrenceOverride {
  readonly startAt?: string | null;
  readonly endAt?: string | null;
}

export interface CalendarOccurrence {
  readonly id: string;
  readonly sourceId: string;
  readonly occurrenceRef: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly timeZone: string;
  readonly isDetached: boolean;
}

export interface ConflictItem {
  readonly leftId: string;
  readonly rightId: string;
  readonly leftStartAt: string;
  readonly leftEndAt: string;
  readonly rightStartAt: string;
  readonly rightEndAt: string;
}

export interface LayoutItem {
  readonly occurrenceRef: string;
  readonly column: number;
  readonly totalColumns: number;
}

export interface CrossDaySlice {
  readonly occurrenceRef: string;
  readonly day: string;
  readonly sliceStartAt: string;
  readonly sliceEndAt: string;
  readonly isStartSlice: boolean;
  readonly isEndSlice: boolean;
}

export type DashboardCalendarView = 'today' | 'week' | 'month';

export interface ViewRangeAnchor {
  readonly anchorDate: string;
  readonly timeZone: string;
}
