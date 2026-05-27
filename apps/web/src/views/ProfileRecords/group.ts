import type { components } from '@sikao/api-client/types/api.generated';

/*
 * group.ts — ProfileRecords day-group + kind mapping helpers.
 *
 * Why: sik-fu-c §2.3 day-group is rendered view-side from the flat
 *      `LearningRecordItemV2[]` payload; backend doesn't pre-bucket by
 *      day (AGENT-H6: contract not changed; the bucketing is purely
 *      presentational). Kind → visual variant map encodes the 6 prototype
 *      ico color buckets (`k-practice`, `k-mock`, `k-review`,
 *      `k-shenlun`, `k-note`, `k-error`). Backend currently emits 2
 *      kinds (`xingce_practice` / `essay_submission`); unknown / future
 *      kinds fall through to a `unknown` bucket which renders the neutral
 *      fallback (no fake mapping, AGENT-H7).
 *
 *      Pure data layer — no nav/tab changes.
 */

type LearningRecordItemV2 = components['schemas']['LearningRecordItemV2'];

export type RecordKindVariant =
  | 'practice'
  | 'mock'
  | 'review'
  | 'shenlun'
  | 'note'
  | 'error'
  | 'unknown';

const PRACTICE_LABEL = '练习';
const MOCK_LABEL = '模考';
const REVIEW_LABEL = '复盘';
const SHENLUN_LABEL = '申论';
const NOTE_LABEL = '笔记';
const ERROR_LABEL = '里程碑';
const UNKNOWN_LABEL = '其它';

/**
 * Map backend `kind` strings to a visual variant. Unknown kinds fall
 * back to `unknown` rather than guessing — AGENT-H7 fail-fast.
 */
export function variantForKind(kind: string): RecordKindVariant {
  switch (kind) {
    case 'xingce_practice':
      return 'practice';
    case 'essay_submission':
      return 'shenlun';
    // Future-ready: backend doesn't emit these yet, but the mapping is
    // declared so when SIK-FU-N adds them the UI starts rendering
    // correctly without code change beyond this map.
    case 'mock_exam':
      return 'mock';
    case 'review_session':
      return 'review';
    case 'note_edit':
      return 'note';
    case 'milestone':
      return 'error';
    default:
      return 'unknown';
  }
}

/** Returns the user-facing tag label rendered next to event title. */
export function tagLabelForKind(kind: string): string {
  switch (variantForKind(kind)) {
    case 'practice':
      return PRACTICE_LABEL;
    case 'mock':
      return MOCK_LABEL;
    case 'review':
      return REVIEW_LABEL;
    case 'shenlun':
      return SHENLUN_LABEL;
    case 'note':
      return NOTE_LABEL;
    case 'error':
      return ERROR_LABEL;
    default:
      return UNKNOWN_LABEL;
  }
}

/** SpriteIcon id matching the variant. */
export function iconIdForVariant(variant: RecordKindVariant): string {
  switch (variant) {
    case 'practice':
      return 'nav-practice';
    case 'mock':
      return 'cat-shenlun';
    case 'review':
      return 'nav-review';
    case 'shenlun':
      return 'cat-shenlun';
    case 'note':
      return 'nav-note';
    case 'error':
      return 'warning';
    case 'unknown':
      return 'info';
  }
}

export interface DayGroup {
  /** YYYY-MM-DD local stamp. */
  readonly stamp: string;
  /** Localized weekday label (星期一 ... 星期日). */
  readonly weekLabel: string;
  /** Optional relative-day label (今天 / 昨天 / 前天). */
  readonly relativeLabel: string | null;
  readonly items: ReadonlyArray<LearningRecordItemV2>;
}

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalStamp = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const todayStamp = (): string => toLocalStamp(new Date().toISOString());

function relativeLabelFor(stamp: string): string | null {
  const today = new Date(`${todayStamp()}T00:00:00`);
  const target = new Date(`${stamp}T00:00:00`);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays === 2) return '前天';
  return null;
}

function weekLabelFor(stamp: string): string {
  const dow = new Date(`${stamp}T00:00:00`).getDay();
  return WEEKDAY_LABELS[dow] ?? '';
}

/**
 * Bucket a flat list of records by local-day stamp. Keeps records in
 * the same order the backend returned them (descending by occurredAt).
 */
export function groupByDay(items: ReadonlyArray<LearningRecordItemV2>): ReadonlyArray<DayGroup> {
  const buckets = new Map<string, LearningRecordItemV2[]>();
  for (const item of items) {
    const stamp = toLocalStamp(item.occurredAt);
    const bucket = buckets.get(stamp);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(stamp, [item]);
    }
  }
  return Array.from(buckets.entries()).map(([stamp, groupItems]) => ({
    stamp,
    weekLabel: weekLabelFor(stamp),
    relativeLabel: relativeLabelFor(stamp),
    items: groupItems,
  }));
}

/** "YYYY-MM-DD 至 YYYY-MM-DD" sub-text rendered in FilterBar / footer. */
export function formatRangeLabel(items: ReadonlyArray<LearningRecordItemV2>): string {
  if (items.length === 0) return '';
  const stamps = items.map((item) => toLocalStamp(item.occurredAt));
  let min = stamps[0];
  let max = stamps[0];
  for (const s of stamps) {
    if (s < min) min = s;
    if (s > max) max = s;
  }
  if (min === max) return min;
  return `${min} 至 ${max}`;
}

/** "HH:MM" local time used in the timeline left column. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
