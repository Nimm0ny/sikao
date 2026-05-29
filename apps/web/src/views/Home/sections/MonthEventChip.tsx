// lint-allow-ui-copy: V5 SIK-142 / SIK-141 calendar chip copy is locked by
// the visual contract and reused in browser evidence.
import { Check } from 'lucide-react';
import type { Ref } from 'react';
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from '@dnd-kit/core';

import type { PlanEventAggregateReadV2, PlanEventReadV2 } from '@sikao/api-client/types/home';
import type { CrossDaySlice } from '@sikao/calendar-engine';
import { zonedDateKey } from '@sikao/shared-utils';

import { eventKindLabel, eventKindOf } from './eventKind';
import { EventKindIcon } from './EventKindIcon';
import { deriveChipTone, type ChipTone } from './deriveChipTone';
import type { CalendarAggregateQueryState } from './eventAggregates';
import { chipAggregateLabel } from './eventAggregates';
import type { CalendarCardProperty } from './calendarViewConfig';
import styles from './MonthEventChip.module.css';

const TZ = 'Asia/Shanghai';

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
  readonly visibleProperties: readonly CalendarCardProperty[];
  readonly slice?: CrossDaySlice;
  readonly onClick?: () => void;
  readonly aggregate?: PlanEventAggregateReadV2;
  readonly aggregateState?: Pick<CalendarAggregateQueryState, 'isLoaded' | 'isError'>;
  readonly peekAnchorId?: string;
  readonly optimisticPatch?: Partial<PlanEventReadV2>;
  readonly today?: string;
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
  aggregate,
  aggregateState,
  peekAnchorId,
  optimisticPatch,
  today,
  drag,
}: MonthEventChipProps) {
  const resolvedAggregateState = aggregateState ?? { isLoaded: aggregate !== undefined, isError: false };
  const event = optimisticPatch ? { ...sourceEvent, ...optimisticPatch } : sourceEvent;
  const kind = eventKindOf(event);
  const isCrossDay = slice !== undefined && (!slice.isStartSlice || !slice.isEndSlice);

  const todayStamp = today ?? localTodayStamp();
  const tone = deriveChipTone(event, todayStamp, slice, TZ);

  const renderKind = showProp(visibleProperties, 'kind');
  const renderTitle = showProp(visibleProperties, 'title');
  const isDone = tone === 'done';
  const isSkipped = tone === 'skipped';
  const aggregateLabel = chipAggregateLabel(aggregate, resolvedAggregateState);

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
        {aggregateLabel !== null ? (
          <span className={styles.aggregateLine} data-testid="home-month-event-aggregate">
            {aggregateLabel}
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
      <span className={styles.srOnly}>{`${eventKindLabel(kind)} · ${TONE_LABEL[tone]}`}</span>
    </button>
  );
}
