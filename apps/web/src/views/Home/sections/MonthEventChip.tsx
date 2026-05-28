// lint-allow-ui-copy: V5 SIK-138 W5 calendar chip copy. CJK strings (kind /
// status / source labels) come from visual contract §3 channel encodings.
import { Download, Link2, Plus, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
import type { CrossDaySlice } from '@sikao/calendar-engine';

import { eventKindOf, eventKindLabel, type EventKind } from './eventKind';
import type { CalendarCardProperty } from './calendarViewConfig';
import styles from './MonthEventChip.module.css';

/*
 * MonthEventChip — SIK-138 W5.
 *
 * Why: visual contract §3 locks 7 visible-property channels to non-overlapping
 *      visual encodings. This component owns the chip surface for the month
 *      view; week and today still ship the lighter chip the legacy view
 *      defined. Channels:
 *        - kind        → border-left color + tinted background
 *        - title       → primary text
 *        - category    → secondary text (detail preset only)
 *        - status      → status dot (planned / in_progress / done / skipped)
 *        - source      → lucide icon (Sparkles / Plus / Download)
 *        - linkedSession → Link2 icon
 *        - target      → 'T' badge
 *
 *      AGENT-H6 / Define-First: visibleProperties comes from
 *      CalendarViewConfig and is the single switch that toggles channels.
 *      The component never consults the preference store directly.
 *
 *      AGENT-H7: every channel is gated by an explicit visibleProperties
 *      check; no silent defaults. Missing optional event fields render no
 *      visual artifact instead of falling back to a placeholder glyph.
 */

export interface MonthEventChipProps {
  readonly event: PlanEventReadV2;
  /** Subset of channels to render. Comes from CalendarViewConfig. */
  readonly visibleProperties: readonly CalendarCardProperty[];
  /**
   * Cross-day slice metadata. When the event spans multiple days the chip
   * adds a `data-cross-day` attribute so the day cell can mark continuation
   * without changing layout. Optional so non-cross-day single-day chips can
   * skip the slice altogether.
   */
  readonly slice?: CrossDaySlice;
  /**
   * Click handler. SIK-138 W6 wires this to `useCalendarPeek().open` so
   * any chip in the month view opens the read-only peek card. Optional
   * because storybook / unit tests may render chips without a peek.
   */
  readonly onClick?: () => void;
}

const KIND_VAR_BY_KIND: Readonly<Record<EventKind, string>> = {
  plan: 'var(--cal-kind-plan)',
  practice: 'var(--cal-kind-practice)',
  mock: 'var(--cal-kind-mock)',
  milestone: 'var(--cal-kind-milestone)',
};

function kindStyle(kind: EventKind): CSSProperties {
  // Expose the active kind color via custom property so the CSS module
  // can mix it into background / border without per-kind selectors.
  return { '--cal-chip-kind-color': KIND_VAR_BY_KIND[kind] } as CSSProperties;
}

function showProp(
  visibleProperties: readonly CalendarCardProperty[],
  property: CalendarCardProperty,
): boolean {
  return visibleProperties.includes(property);
}

function StatusDot({ status, kind }: { readonly status: string; readonly kind: EventKind }) {
  // status uses the kind color for in_progress; planned / skipped stay
  // neutral so the dot does not double-encode kind.
  return (
    <span
      className={styles.dot}
      data-status={status}
      style={{ '--cal-chip-kind-color': KIND_VAR_BY_KIND[kind] } as CSSProperties}
      aria-label={`状态：${statusLabel(status)}`}
    />
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'planned': return '待办';
    case 'in_progress': return '进行中';
    case 'done': return '已完成';
    case 'skipped': return '跳过';
    default: return status;
  }
}

function SourceIcon({ source }: { readonly source: string }) {
  // V1 source vocabulary: ai / manual / import. Unknown source renders no
  // icon (fail-fast intent — visual contract §3 forbids guessing).
  if (source === 'ai') {
    return <Sparkles className={styles.icon} role="img" aria-label="AI 排程" />;
  }
  if (source === 'manual') {
    return <Plus className={styles.icon} role="img" aria-label="人工创建" />;
  }
  if (source === 'import') {
    return <Download className={styles.icon} role="img" aria-label="外部导入" />;
  }
  return null;
}

export function MonthEventChip({ event, visibleProperties, slice, onClick }: MonthEventChipProps) {
  const kind = eventKindOf(event);
  const isCrossDay = slice !== undefined && (!slice.isStartSlice || !slice.isEndSlice);

  const renderKind = showProp(visibleProperties, 'kind');
  const renderTitle = showProp(visibleProperties, 'title');
  const renderCategory = showProp(visibleProperties, 'category');
  const renderStatus = showProp(visibleProperties, 'status');
  const renderSource = showProp(visibleProperties, 'source');
  const renderLink = showProp(visibleProperties, 'linkedSession');
  const renderTarget = showProp(visibleProperties, 'target');

  return (
    <button
      type="button"
      className={styles.chip}
      data-testid="home-month-event"
      data-kind={kind}
      data-cross-day={isCrossDay || undefined}
      data-kind-disabled={renderKind ? undefined : true}
      style={renderKind ? kindStyle(kind) : undefined}
      onClick={onClick}
      title={event.title}
      aria-label={`查看事件：${event.title}`}
    >
      <span className={styles.titles}>
        {renderTitle ? (
          <span className={styles.titleText} data-testid="home-month-event-title">
            {event.title}
          </span>
        ) : null}
        {renderCategory && event.category ? (
          <span className={styles.metaText} data-testid="home-month-event-category">
            {event.category}
          </span>
        ) : null}
      </span>
      {renderStatus || renderSource || renderLink || renderTarget ? (
        <span className={styles.icons} aria-hidden={!renderStatus}>
          {renderStatus ? <StatusDot status={event.status} kind={kind} /> : null}
          {renderSource ? <SourceIcon source={event.source} /> : null}
          {renderLink && event.linkedSessionId !== null ? (
            <Link2
              className={styles.icon}
              role="img"
              aria-label="关联学习会话"
              data-testid="home-month-event-link"
            />
          ) : null}
          {renderTarget && event.targetId !== null ? (
            <span
              className={styles.targetBadge}
              data-testid="home-month-event-target"
              aria-label="绑定考试目标"
            >
              T
            </span>
          ) : null}
        </span>
      ) : null}
      {/* eventKindLabel intentionally exposed for screen readers via aria-hidden;
          visible kind cue is the border-left color, sr text below mirrors it. */}
      <span className={styles.srOnly}>{eventKindLabel(kind)}</span>
    </button>
  );
}
