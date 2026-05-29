// lint-allow-ui-copy: V5 SIK-142 W1 calendar chip copy. CJK strings (kind /
// tone status labels) come from visual contract §3 channel encodings.
import { Check } from 'lucide-react';
import type { Ref } from 'react';
// Type-only import: SIK-139 W1. Pulling dnd-kit's draggable shapes as types
// keeps this chip statically importable with ZERO runtime dnd-kit dependency
// (verbatimModuleSyntax erases the import), so the chip stays in the Home
// first-paint chunk while the dnd-kit runtime is lazy-loaded via MonthGridDnd.
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from '@dnd-kit/core';

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
import type { CrossDaySlice } from '@sikao/calendar-engine';
import { zonedDateKey } from '@sikao/shared-utils';

import { eventKindOf, eventKindLabel } from './eventKind';
import { EventKindIcon } from './EventKindIcon';
import { deriveChipTone, type ChipTone } from './deriveChipTone';
import type { CalendarCardProperty } from './calendarViewConfig';
import styles from './MonthEventChip.module.css';

/*
 * MonthEventChip — SIK-138 W5 surface, re-channelled by SIK-142 W1.
 *
 * Why: SIK-142 visual contract §3.1 collapses the SIK-138 7-channel chip to
 *      FOUR surface channels; the rest move to the read-only Peek (W5):
 *        - time-status tone → border-left + bg + text color (§3.2, the
 *          primary channel; derived by `deriveChipTone`, NOT event kind)
 *        - kind             → NEUTRAL leading icon (no color — §4.3)
 *        - title            → primary text (skipped tone adds strikethrough)
 *        - done             → ✓ check (double-encoding alongside done tone)
 *      Removed from the chip surface (→ Peek): category, status dot, source
 *      icon, linked-session icon, target badge.
 *
 *      AGENT-H7: tone derivation throws on an unparseable timestamp via
 *      `zonedDateKey` (no silent fallback). The same shared util backs the
 *      SIK-139 conflict guard.
 *
 *      The drag / peek / optimistic plumbing (SIK-138/139) is unchanged: the
 *      chip stays a plain, statically-importable <button> whose `drag` prop
 *      is threaded by the lazy MonthGridDnd.
 */

const TZ = 'Asia/Shanghai';

/** Current local day (YYYY-MM-DD) in the calendar zone. */
function localTodayStamp(timeZone: string = TZ): string {
  return zonedDateKey(new Date().toISOString(), timeZone);
}

const TONE_LABEL: Readonly<Record<ChipTone, string>> = {
  done: '已完成',
  skipped: '已跳过',
  overdue: '已逾期',
  today: '今天',
  future: '未来',
};

export interface MonthEventChipProps {
  readonly event: PlanEventReadV2;
  /** Subset of channels to render. Comes from CalendarViewConfig. */
  readonly visibleProperties: readonly CalendarCardProperty[];
  /**
   * Cross-day slice metadata. When the event spans multiple days the chip
   * adds a `data-cross-day` attribute so the day cell can mark continuation,
   * and `slice.day` anchors the today/future tone test (§3.2). Optional so
   * single-day chips can skip the slice altogether.
   */
  readonly slice?: CrossDaySlice;
  /** Click handler. The month view wires this to the read-only Peek. */
  readonly onClick?: () => void;
  /** Per-slice anchor id for `data-peek-anchor` (SIK-139 W0). */
  readonly peekAnchorId?: string;
  /** Read-time optimistic patch (SIK-139); merged over the event for render. */
  readonly optimisticPatch?: Partial<PlanEventReadV2>;
  /**
   * Current local day (YYYY-MM-DD). Defaults to `localTodayStamp()`; tests
   * inject a fixed value so tone assertions are deterministic.
   */
  readonly today?: string;
  /**
   * Drag wiring from dnd-kit's `useDraggable` (SIK-139 W1). Omitted in the
   * static render path and unit tests, where the chip is read-only.
   */
  readonly drag?: {
    readonly setNodeRef: Ref<HTMLButtonElement>;
    readonly attributes: DraggableAttributes;
    readonly listeners: DraggableSyntheticListeners;
    readonly isDragging: boolean;
  };
}

function showProp(
  visibleProperties: readonly CalendarCardProperty[],
  property: CalendarCardProperty,
): boolean {
  return visibleProperties.includes(property);
}

export function MonthEventChip({
  event: sourceEvent,
  visibleProperties,
  slice,
  onClick,
  peekAnchorId,
  optimisticPatch,
  today,
  drag,
}: MonthEventChipProps) {
  // SIK-139 W0 (D20): merge the optimistic patch over the source event for
  // render only. A no-op spread when no patch is supplied.
  const event = optimisticPatch ? { ...sourceEvent, ...optimisticPatch } : sourceEvent;
  const kind = eventKindOf(event);
  const isCrossDay = slice !== undefined && (!slice.isStartSlice || !slice.isEndSlice);

  // §3.2 tone is the chip's primary (color) channel — time-completion status,
  // anchored on the local day. H7: throws on an unparseable timestamp.
  const todayStamp = today ?? localTodayStamp();
  const tone = deriveChipTone(event, todayStamp, slice, TZ);

  const renderKind = showProp(visibleProperties, 'kind');
  const renderTitle = showProp(visibleProperties, 'title');
  const isDone = tone === 'done';
  const isSkipped = tone === 'skipped';

  return (
    <button
      type="button"
      ref={drag?.setNodeRef}
      className={styles.chip}
      data-testid="home-month-event"
      data-event-id={event.id}
      data-peek-anchor={peekAnchorId ?? event.id}
      data-kind={kind}
      data-tone={tone}
      data-cross-day={isCrossDay || undefined}
      data-dragging={drag?.isDragging || undefined}
      onClick={onClick}
      title={event.title}
      aria-label={`查看事件：${event.title}（${TONE_LABEL[tone]}）`}
      {...(drag?.attributes ?? {})}
      {...(drag?.listeners ?? {})}
    >
      {renderKind ? <EventKindIcon kind={kind} className={styles.kindIcon} /> : null}
      <span className={styles.titles}>
        {renderTitle ? (
          <span
            className={styles.titleText}
            data-skipped={isSkipped || undefined}
            data-testid="home-month-event-title"
          >
            {event.title}
          </span>
        ) : null}
      </span>
      {isDone ? (
        <Check
          className={styles.doneCheck}
          role="img"
          aria-hidden="true"
          data-testid="home-month-event-done"
        />
      ) : null}
      {/* eventKindLabel + tone exposed for screen readers; the visible cues
          are the leading icon (kind) and the tone color + ✓ (done). */}
      <span className={styles.srOnly}>{`${eventKindLabel(kind)} · ${TONE_LABEL[tone]}`}</span>
    </button>
  );
}
