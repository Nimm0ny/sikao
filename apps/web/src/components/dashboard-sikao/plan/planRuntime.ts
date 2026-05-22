import {
  buildOverlapLayout,
  detectConflicts,
  differenceInCalendarMinutes,
  endOfLocalDay,
  fromLocalDateTime,
  sliceOccurrenceByDay,
  startOfLocalDay,
  toLocalDateStamp,
  type CalendarOccurrence,
  type ConflictItem,
  type LayoutItem,
} from '@sikao/calendar-engine';
import type {
  DashboardFullPlanResponseV2,
  PlanAdjustmentReadV2,
  PlanAutoGenerateRequestV2,
  PlanEventReadV2,
  PlanEventUpdateRequestV2,
  PlanReadV2,
  PlanRegenerateRangeRequestV2,
  ProfileGoalsResponseV2,
} from '@sikao/api-client/types/home';

type PracticeBlockV2 = NonNullable<DashboardFullPlanResponseV2['practiceBlocks']>[number];

export const HOME_TIME_ZONE = 'Asia/Shanghai';

export type HomePlanView = 'today' | 'week' | 'month';

export interface CalendarEventSlice {
  readonly event: PlanEventReadV2;
  readonly occurrenceRef: string;
  readonly day: string;
  readonly startMinutes: number;
  readonly endMinutes: number;
  readonly layout: LayoutItem;
  readonly startsOnThisDay: boolean;
  readonly endsOnThisDay: boolean;
}

export interface DayBucket {
  day: string;
  eventSlices: readonly CalendarEventSlice[];
  practiceBlocks: readonly PracticeBlockSlice[];
}

export interface EventDraftValues {
  readonly title: string;
  readonly category: string;
  readonly startDay: string;
  readonly startTime: string;
  readonly endDay: string;
  readonly endTime: string;
  readonly notes: string;
  readonly status: string;
  readonly recurringRule: string;
  readonly timezone: string;
}

interface ColumnGeometry {
  readonly leftPercent: number;
  readonly widthPercent: number;
}

export interface PracticeBlockSlice {
  readonly block: PracticeBlockV2;
  readonly day: string;
  readonly startMinutes: number;
  readonly endMinutes: number;
  readonly startsOnThisDay: boolean;
  readonly endsOnThisDay: boolean;
}

const DATE_TIME_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function parseIsoDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function formatIsoDay(day: Date): string {
  return day.toISOString().slice(0, 10);
}

function addUtcDays(day: string, delta: number): string {
  const next = parseIsoDay(day);
  next.setUTCDate(next.getUTCDate() + delta);
  return formatIsoDay(next);
}

function addUtcMonths(day: string, delta: number): string {
  const next = parseIsoDay(day);
  next.setUTCMonth(next.getUTCMonth() + delta);
  return formatIsoDay(next);
}

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = DATE_TIME_FORMATTER_CACHE.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  DATE_TIME_FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

function formatLocalDateTimeParts(
  iso: string,
  timeZone: string,
): Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> {
  const parts = getDateTimeFormatter(timeZone).formatToParts(new Date(iso));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: values.get('year') ?? '1970',
    month: values.get('month') ?? '01',
    day: values.get('day') ?? '01',
    hour: values.get('hour') ?? '00',
    minute: values.get('minute') ?? '00',
  };
}

function buildOccurrence(event: PlanEventReadV2): CalendarOccurrence {
  return {
    id: event.id,
    sourceId: event.id,
    occurrenceRef: event.id,
    startAt: event.startAt,
    endAt: event.endAt,
    timeZone: event.timezone,
    isDetached: event.isRecurringInstance,
  };
}

function buildLayoutMap(events: readonly PlanEventReadV2[]): Readonly<Record<string, LayoutItem>> {
  return buildOverlapLayout(events.map(buildOccurrence));
}

function toStartMinutes(day: string, iso: string, timeZone: string): number {
  const dayStart = startOfLocalDay(day, timeZone).toISOString();
  return Math.max(0, differenceInCalendarMinutes(dayStart, iso));
}

function toEndMinutes(day: string, iso: string, timeZone: string): number {
  const dayStart = startOfLocalDay(day, timeZone).toISOString();
  return Math.max(15, differenceInCalendarMinutes(dayStart, iso));
}

export function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  for (;;) {
    days.push(cursor);
    if (cursor === to) break;
    cursor = addUtcDays(cursor, 1);
  }
  return days;
}

export function buildDayBuckets(
  payload: {
    readonly events?: readonly PlanEventReadV2[];
    readonly practiceBlocks?: readonly PracticeBlockV2[];
    readonly from: string;
    readonly to: string;
  },
): readonly DayBucket[] {
  const events = payload.events ?? [];
  const practiceBlocks = payload.practiceBlocks ?? [];
  const layoutMap = buildLayoutMap(events);
  const dayBuckets = new Map<string, DayBucket>();

  for (const day of enumerateDays(payload.from, payload.to)) {
    dayBuckets.set(day, {
      day,
      eventSlices: [],
      practiceBlocks: [],
    });
  }

  for (const slice of slicePracticeBlocks(practiceBlocks)) {
    const bucket = dayBuckets.get(slice.day);
    if (!bucket) continue;
    bucket.practiceBlocks = [...bucket.practiceBlocks, slice].sort(
      (left, right) => left.startMinutes - right.startMinutes,
    );
  }

  for (const event of events) {
    for (const slice of sliceOccurrenceByDay(buildOccurrence(event))) {
      const bucket = dayBuckets.get(slice.day);
      if (!bucket) continue;
      bucket.eventSlices = [
        ...bucket.eventSlices,
        {
          event,
          occurrenceRef: slice.occurrenceRef,
          day: slice.day,
          startMinutes: toStartMinutes(slice.day, slice.sliceStartAt, event.timezone),
          endMinutes: toEndMinutes(slice.day, slice.sliceEndAt, event.timezone),
          layout: layoutMap[slice.occurrenceRef] ?? {
            occurrenceRef: slice.occurrenceRef,
            column: 0,
            totalColumns: 1,
          },
          startsOnThisDay: slice.isStartSlice,
          endsOnThisDay: slice.isEndSlice,
        },
      ].sort((left, right) => left.startMinutes - right.startMinutes);
    }
  }

  return enumerateDays(payload.from, payload.to).map((day) => dayBuckets.get(day)!);
}

export function mergeOptimisticEvents(
  baseEvents: readonly PlanEventReadV2[] | undefined,
  optimisticEvents: ReadonlyMap<string, Partial<PlanEventReadV2>>,
): PlanEventReadV2[] {
  const merged = new Map<string, PlanEventReadV2>();
  for (const event of baseEvents ?? []) {
    merged.set(event.id, {
      ...event,
      ...(optimisticEvents.get(event.id) ?? {}),
    });
  }
  return [...merged.values()];
}

export function shiftAnchorDate(
  anchorDate: string,
  view: HomePlanView,
  delta: -1 | 1,
): string {
  if (view === 'today') return addUtcDays(anchorDate, delta);
  if (view === 'week') return addUtcDays(anchorDate, delta * 7);
  return addUtcMonths(anchorDate, delta);
}

export function formatAnchorLabel(view: HomePlanView, from: string, to: string): string {
  if (view === 'today') return from;
  if (view === 'week') return `${from} - ${to}`;
  return `${from.slice(0, 7)} (${from} - ${to})`;
}

export function formatEventTime(iso: string, timeZone = HOME_TIME_ZONE): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

export function toEventInputDay(iso: string, timeZone: string): string {
  const parts = formatLocalDateTimeParts(iso, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function toEventInputTime(iso: string, timeZone: string): string {
  const parts = formatLocalDateTimeParts(iso, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function toLocalMinutes(iso: string, timeZone: string): number {
  const parts = formatLocalDateTimeParts(iso, timeZone);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function computeColumnGeometry(
  column: number,
  totalColumns: number,
  gutterPercent = 2,
): ColumnGeometry {
  const safeColumns = Math.max(1, totalColumns);
  const totalGutter = gutterPercent * (safeColumns + 1);
  const widthPercent = Math.max(0, (100 - totalGutter) / safeColumns);
  const leftPercent = gutterPercent + column * (widthPercent + gutterPercent);
  return {
    leftPercent,
    widthPercent,
  };
}

export function slicePracticeBlocks(
  practiceBlocks: readonly PracticeBlockV2[],
): readonly PracticeBlockSlice[] {
  const slices: PracticeBlockSlice[] = [];

  for (const block of practiceBlocks) {
    const startAt = new Date(block.startAt);
    const endAt = new Date(block.endAt);
    const startDay = toLocalDateStamp(startAt, HOME_TIME_ZONE);
    const endDay = toLocalDateStamp(endAt, HOME_TIME_ZONE);

    for (const day of enumerateDays(startDay, endDay)) {
      const dayStart = startOfLocalDay(day, HOME_TIME_ZONE);
      const dayEnd = endOfLocalDay(day, HOME_TIME_ZONE);
      const sliceStart = new Date(Math.max(dayStart.getTime(), startAt.getTime()));
      const sliceEnd = new Date(Math.min(dayEnd.getTime(), endAt.getTime()));

      if (sliceEnd <= sliceStart) continue;

      slices.push({
        block,
        day,
        startMinutes: toStartMinutes(day, sliceStart.toISOString(), HOME_TIME_ZONE),
        endMinutes: toEndMinutes(day, sliceEnd.toISOString(), HOME_TIME_ZONE),
        startsOnThisDay: day === startDay,
        endsOnThisDay: day === endDay,
      });
    }
  }

  return slices;
}

export function buildEventDraft(
  event: PlanEventReadV2 | null,
  anchorDay: string,
): EventDraftValues {
  if (!event) {
    return {
      title: '',
      category: 'review',
      startDay: anchorDay,
      startTime: '09:00',
      endDay: anchorDay,
      endTime: '10:00',
      notes: '',
      status: 'planned',
      recurringRule: '',
      timezone: HOME_TIME_ZONE,
    };
  }

  return {
    title: event.title,
    category: event.category,
    startDay: toEventInputDay(event.startAt, event.timezone),
    startTime: toEventInputTime(event.startAt, event.timezone),
    endDay: toEventInputDay(event.endAt, event.timezone),
    endTime: toEventInputTime(event.endAt, event.timezone),
    notes: event.notes,
    status: event.status,
    recurringRule: event.recurringRule ?? '',
    timezone: event.timezone,
  };
}

function parseDraftDateTimeToIso(
  day: string,
  time: string,
  timeZone: string,
  fieldName: string,
): string {
  if (day.trim().length === 0 || time.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  const parsed = fromLocalDateTime(day, time, timeZone);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }
  return parsed.toISOString();
}

export function toEventPayload(
  values: EventDraftValues,
): { create: Omit<PlanEventReadV2, 'id' | 'planId' | 'source' | 'parentId' | 'recurringParentId' | 'recurringExceptionDates' | 'linkedSessionId' | 'targetId' | 'deletedAt' | 'isRecurringInstance'>; update: PlanEventUpdateRequestV2 } {
  const startAt = parseDraftDateTimeToIso(
    values.startDay,
    values.startTime,
    values.timezone,
    'Event start date/time',
  );
  const endAt = parseDraftDateTimeToIso(
    values.endDay,
    values.endTime,
    values.timezone,
    'Event end date/time',
  );
  return {
    create: {
      category: values.category,
      endAt,
      notes: values.notes,
      startAt,
      status: values.status,
      timezone: values.timezone,
      title: values.title,
      recurringRule: values.recurringRule.length > 0 ? values.recurringRule : null,
    },
    update: {
      category: values.category,
      endAt,
      notes: values.notes,
      startAt,
      status: values.status as PlanEventUpdateRequestV2['status'],
      timezone: values.timezone,
      title: values.title,
      recurringRule: values.recurringRule.length > 0 ? values.recurringRule : null,
    },
  };
}

export function moveEventByDays(
  event: PlanEventReadV2,
  fromDay: string,
  toDay: string,
): PlanEventUpdateRequestV2 {
  const deltaDays =
    (parseIsoDay(toDay).getTime() - parseIsoDay(fromDay).getTime()) / (24 * 60 * 60 * 1000);
  const startLocalDay = toEventInputDay(event.startAt, event.timezone);
  const startLocalTime = toEventInputTime(event.startAt, event.timezone);
  const endLocalDay = toEventInputDay(event.endAt, event.timezone);
  const endLocalTime = toEventInputTime(event.endAt, event.timezone);
  return {
    startAt: fromLocalDateTime(
      addUtcDays(startLocalDay, deltaDays),
      startLocalTime,
      event.timezone,
    ).toISOString(),
    endAt: fromLocalDateTime(
      addUtcDays(endLocalDay, deltaDays),
      endLocalTime,
      event.timezone,
    ).toISOString(),
  };
}

export function resizeEventByMinutes(
  event: PlanEventReadV2,
  deltaMinutes: number,
): PlanEventUpdateRequestV2 {
  return {
    endAt: new Date(new Date(event.endAt).getTime() + deltaMinutes * 60 * 1000).toISOString(),
  };
}

export function buildDraftConflicts(
  events: readonly PlanEventReadV2[],
  currentEventId: string | null,
  draftValues: EventDraftValues,
): readonly ConflictItem[] {
  let update: PlanEventUpdateRequestV2;
  try {
    update = toEventPayload(draftValues).update;
  } catch {
    return [];
  }
  const draftEvent: PlanEventReadV2 = {
    id: currentEventId ?? '__draft__',
    planId: 0,
    title: draftValues.title || 'Draft event',
    category: draftValues.category,
    notes: draftValues.notes,
    startAt: update.startAt ?? new Date().toISOString(),
    endAt: update.endAt ?? new Date().toISOString(),
    timezone: draftValues.timezone,
    status: draftValues.status,
    source: 'user_manual',
    parentId: null,
    recurringRule: draftValues.recurringRule.length > 0 ? draftValues.recurringRule : null,
    recurringParentId: null,
    recurringExceptionDates: [],
    linkedSessionId: null,
    targetId: null,
    deletedAt: null,
    isRecurringInstance: false,
  };
  const occurrences = [...events.filter((event) => event.id !== draftEvent.id), draftEvent].map(
    buildOccurrence,
  );
  return detectConflicts(occurrences).filter((conflict) =>
    [conflict.leftId, conflict.rightId].includes(draftEvent.id),
  );
}

export function normalizeRange(from: string, to: string): { from: string; to: string } {
  return from <= to ? { from, to } : { from: to, to: from };
}

export function buildGeneratePayload(
  activePlan: PlanReadV2 | null,
  profileGoals: ProfileGoalsResponseV2 | undefined,
): PlanAutoGenerateRequestV2 {
  const firstTarget = profileGoals?.examTargets?.[0];
  return {
    name: activePlan?.name ?? 'Home sprint plan',
    targetExamId: activePlan?.targetExamId ?? firstTarget?.examId ?? 'target-exam',
    targetExamDate: activePlan?.targetExamDate ?? firstTarget?.examDate ?? addUtcDays(formatIsoDay(new Date()), 60),
    dailyMinutesTarget: activePlan?.dailyMinutesTarget ?? ((profileGoals?.weeklyTargetHours ?? 14) * 60) / 7,
    style: activePlan?.style ?? 'balanced',
    focusSubjects: activePlan?.focusSubjects ?? firstTarget?.subjects ?? ['xingce'],
    baseline: activePlan?.baseline ?? {},
    userNotes: '',
  };
}

export function buildRegeneratePayload(
  planId: number,
  range: { readonly from: string; readonly to: string },
): PlanRegenerateRangeRequestV2 {
  return {
    planId,
    from: range.from,
    to: range.to,
    userNotes: '',
  };
}

export function visibleAdjustment(
  adjustments: readonly PlanAdjustmentReadV2[] | undefined,
  dismissedByAdjustmentId: Readonly<Record<string, number>>,
): PlanAdjustmentReadV2 | null {
  return (
    adjustments?.find((adjustment) => !(String(adjustment.id) in dismissedByAdjustmentId)) ?? null
  );
}
