// lint-allow-ui-copy: V5 ProfileRecords day-group head copy. CJK strings
// are visual contract from `Profile Records v1.html` lines 46-50.
// Nav baseline (4 tabs) untouched — this is a per-day group container.
import type { DayGroup as DayGroupModel } from './group';
import { variantForKind } from './group';
import { RecordRow } from './RecordRow';
import styles from './DayGroup.module.css';

/*
 * DayGroup — sticky day head + N-record timeline column.
 *
 * Why: sik-fu-c §2.3 + Acceptance C4 — `.day-head` sticks to top of the
 *      scroll region; summary text shows aggregated counts derived from
 *      the day's records. Aggregation is view-side (no separate backend
 *      contract — keeps the API surface stable).
 */

export interface DayGroupProps {
  readonly group: DayGroupModel;
}

interface KindCounts {
  practice: number;
  mock: number;
  review: number;
  shenlun: number;
  note: number;
  error: number;
  unknown: number;
}

function summarize(items: DayGroupModel['items']): KindCounts {
  const counts: KindCounts = {
    practice: 0,
    mock: 0,
    review: 0,
    shenlun: 0,
    note: 0,
    error: 0,
    unknown: 0,
  };
  for (const item of items) {
    counts[variantForKind(item.kind)] += 1;
  }
  return counts;
}

function summaryParts(counts: KindCounts): ReadonlyArray<{ label: string; value: number }> {
  const parts: Array<{ label: string; value: number }> = [];
  if (counts.practice > 0) parts.push({ label: '练习', value: counts.practice });
  if (counts.mock > 0) parts.push({ label: '模考', value: counts.mock });
  if (counts.shenlun > 0) parts.push({ label: '申论', value: counts.shenlun });
  if (counts.review > 0) parts.push({ label: '复盘', value: counts.review });
  if (counts.note > 0) parts.push({ label: '笔记', value: counts.note });
  if (counts.error > 0) parts.push({ label: '里程碑', value: counts.error });
  return parts;
}

export function DayGroup({ group }: DayGroupProps) {
  const counts = summarize(group.items);
  const parts = summaryParts(counts);

  return (
    <section className={styles.dayGroup} data-testid={`profile-records-day-${group.stamp}`}>
      <header className={styles.dayHead}>
        <span className={styles.date}>{group.stamp}</span>
        <span className={styles.week}>
          {group.weekLabel}
          {group.relativeLabel !== null ? ` · ${group.relativeLabel}` : ''}
        </span>
        <span className={styles.summary}>
          {parts.length === 0 ? null : parts.map((part, idx) => (
            <span key={part.label}>
              {idx > 0 ? ' · ' : ''}
              {part.label} <b>{part.value}</b>
            </span>
          ))}
        </span>
      </header>
      {group.items.map((item) => (
        <RecordRow key={item.id} record={item} />
      ))}
    </section>
  );
}
