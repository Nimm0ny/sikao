// lint-allow-ui-copy: SIK-138 W6 Peek properties copy comes from visual
// contract §2 (8-row property table) + §3 channel labels.
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

import { eventKindLabel, eventKindOf } from '../eventKind';
import styles from './CalendarPeekCard.module.css';

/*
 * CalendarPeekProperties — SIK-138 W6.
 *
 * Why: visual contract §2 locks exactly 8 read-only rows in the peek
 *      property table. Mirrors the prototype mock at
 *      .tmp_review/out/Tab1-Home-mock/home-calendar-notion-like-mock.html
 *      lines 1424–1445 but stays read-only per Requirement 12.
 *
 *      AGENT-H7 read-only: every row renders the value verbatim or a
 *      neutral placeholder; no inline edit. The "—" placeholder is the
 *      documented "no value" cue (visual contract §6 SSOT conflicts row
 *      "mock Peek 可编辑 vs V1 read-only" — V1 read-only is authority).
 */

const STATUS_LABEL: Readonly<Record<string, string>> = {
  planned: '待办',
  in_progress: '进行中',
  done: '已完成',
  skipped: '跳过',
};

const SOURCE_LABEL: Readonly<Record<string, string>> = {
  ai: 'AI 排程',
  manual: '人工创建',
  import: '外部导入',
};

const PLACEHOLDER = '—';

function formatTimeRange(event: PlanEventReadV2): string {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const datePart = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  return sameDay
    ? `${datePart} ${fmt(start)} – ${fmt(end)}`
    : `${datePart} ${fmt(start)} → ${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())} ${fmt(end)}`;
}

export interface CalendarPeekPropertiesProps {
  readonly event: PlanEventReadV2;
}

interface PropertyRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly testId: string;
}

function buildRows(event: PlanEventReadV2): ReadonlyArray<PropertyRow> {
  const kind = eventKindOf(event);
  return [
    { key: 'time', label: '时间', value: formatTimeRange(event), testId: 'home-calendar-peek-time' },
    { key: 'kind', label: '类型', value: eventKindLabel(kind), testId: 'home-calendar-peek-kind' },
    {
      key: 'category',
      label: '分类',
      value: event.category || PLACEHOLDER,
      testId: 'home-calendar-peek-category',
    },
    {
      key: 'status',
      label: '状态',
      value: STATUS_LABEL[event.status] ?? event.status,
      testId: 'home-calendar-peek-status',
    },
    {
      key: 'source',
      label: '来源',
      value: SOURCE_LABEL[event.source] ?? event.source,
      testId: 'home-calendar-peek-source',
    },
    {
      key: 'linkedSession',
      label: '关联会话',
      value: event.linkedSessionId === null || event.linkedSessionId === undefined
        ? PLACEHOLDER
        : String(event.linkedSessionId),
      testId: 'home-calendar-peek-linked',
    },
    {
      key: 'target',
      label: '目标',
      value: event.targetId === null || event.targetId === undefined
        ? PLACEHOLDER
        : String(event.targetId),
      testId: 'home-calendar-peek-target',
    },
    {
      key: 'recurring',
      label: '重复',
      value: event.recurringRule ?? PLACEHOLDER,
      testId: 'home-calendar-peek-recurring',
    },
  ];
}

export function CalendarPeekProperties({ event }: CalendarPeekPropertiesProps) {
  const rows = buildRows(event);
  return (
    <dl className={styles.props} data-testid="home-calendar-peek-properties">
      {rows.map((row) => (
        <div key={row.key} className={styles.propRow}>
          <dt className={styles.propLabel}>{row.label}</dt>
          <dd className={styles.propValue} data-testid={row.testId}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
