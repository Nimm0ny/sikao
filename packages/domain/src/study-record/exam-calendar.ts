// 公考考试日历数据.
//
// ARCH §7.3 P3 (2026-04-28): 数据从前端 hardcoded 移到后端 admin 维护.
// 前端 fetch /api/v2/exam-events 拉, admin 通过 /api/v2/admin/exam-events
// CRUD 维护 (alembic 0006 inline seed 3 个 entries 让投产即可见). 日历
// helpers (daysUntil / urgencyOf / phaseOf / sortByUpcoming / nextExam) 是
// pure helper, 跟数据来源无关, 全留这里.

export type ExamCategory = 'national' | 'provincial' | 'institution' | 'other';
export type DatePrecision = 'confirmed' | 'estimate';

export interface ExamEvent {
  /** Backend integer PK. Use slug as the React key (id 在数据 reseed 后会变). */
  readonly id: number;
  /** Stable string identifier (e.g. 'national-2027'). 适合做 React key + URL. */
  readonly slug: string;
  readonly name: string;
  readonly category: ExamCategory;
  /** Exam day (笔试日), ISO YYYY-MM-DD. */
  readonly examDate: string;
  /** Registration window start, ISO YYYY-MM-DD. Optional. */
  readonly registrationStart?: string;
  /** Registration window end, ISO YYYY-MM-DD. Optional. */
  readonly registrationEnd?: string;
  /** Confidence in dates. Estimate displays a "估" badge in UI. */
  readonly precision: DatePrecision;
  /** Free-form note. */
  readonly notes?: string;
}

/** Difference in whole days from `now` to the ISO date. Positive = future. */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const target = new Date(`${isoDate}T00:00:00`);
  // Normalize both to UTC midnight to avoid DST / TZ noise on day count.
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const ms = targetUtc - nowUtc;
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export type ExamUrgency = 'past' | 'soon' | 'imminent' | 'distant';

/** Color tone selector for the countdown card. */
export function urgencyOf(days: number): ExamUrgency {
  if (days < 0) return 'past';
  if (days <= 7) return 'imminent'; // 一周内 — 临考红
  if (days <= 30) return 'soon';    // 一月内 — 黄
  return 'distant';                   // 月外 — 中性
}

/** Sort events by examDate ascending. Past events at end. */
export function sortByUpcoming(
  events: readonly ExamEvent[],
  now: Date = new Date(),
): readonly ExamEvent[] {
  const annotated = events.map((e) => ({ event: e, days: daysUntil(e.examDate, now) }));
  annotated.sort((a, b) => {
    const aPast = a.days < 0;
    const bPast = b.days < 0;
    if (aPast !== bPast) return aPast ? 1 : -1; // upcoming first
    // both upcoming or both past: ascending by days (closer first / less-recent first)
    return aPast ? b.days - a.days : a.days - b.days;
  });
  return annotated.map((a) => a.event);
}

/** First upcoming event (or null if all past). */
export function nextExam(
  events: readonly ExamEvent[],
  now: Date = new Date(),
): ExamEvent | null {
  const sorted = sortByUpcoming(events, now);
  for (const e of sorted) {
    if (daysUntil(e.examDate, now) >= 0) return e;
  }
  return null;
}

/**
 * P0-2: 优先从 tracked slugs 取第一场未来; 没 tracked 或 tracked 全过期 →
 * fallback 全集第一场 (复用 nextExam). Home 用这个让用户看到「自己关心的
 * 那场」, 而不是按全 events 默认排序的第一场.
 */
export function pickNextExamWithTracking(
  events: readonly ExamEvent[],
  trackedSlugs: ReadonlySet<string>,
  now: Date = new Date(),
): ExamEvent | null {
  if (trackedSlugs.size > 0) {
    const tracked = events.filter((e) => trackedSlugs.has(e.slug));
    const next = nextExam(tracked, now);
    if (next !== null) return next;
  }
  return nextExam(events, now);
}

/** Phase label based on today vs registration / exam dates. */
export type ExamPhase = 'before-registration' | 'registration-open' | 'preparation' | 'imminent' | 'past';

export function phaseOf(event: ExamEvent, now: Date = new Date()): ExamPhase {
  const days = daysUntil(event.examDate, now);
  if (days < 0) return 'past';
  if (days <= 7) return 'imminent';
  if (event.registrationStart !== undefined && event.registrationEnd !== undefined) {
    const startDays = daysUntil(event.registrationStart, now);
    const endDays = daysUntil(event.registrationEnd, now);
    if (startDays > 0) return 'before-registration';
    if (endDays >= 0) return 'registration-open';
  }
  return 'preparation';
}
