/*
 * MonthEventChip tests — SIK-142 W1 (visual contract §3.1 / §3.2).
 *
 * Why: the chip surface collapses to FOUR channels (tone color / kind icon /
 *      title / done ✓). This suite pins:
 *        - tone is driven by deriveChipTone and surfaced via data-tone
 *        - done ✓ + skipped strikethrough double-encoding
 *        - kind renders a NEUTRAL leading icon (no per-kind color attr)
 *        - the removed channels (category / status dot / source / link /
 *          target) are gone from the chip surface (→ Peek, W5)
 *        - the SIK-139 anchor / optimistic-patch contract is unchanged
 */
import { describe, it, expect } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
import type { CrossDaySlice } from '@sikao/calendar-engine';

import { MonthEventChip } from './MonthEventChip';
import type { CalendarCardProperty } from './calendarViewConfig';

const TODAY = '2026-05-26';
const at = (day: string, time = '09:00') => `${day}T${time}:00+08:00`;

const BASE_EVENT: PlanEventReadV2 = {
  id: 'e1',
  title: '言语·片段阅读',
  startAt: at(TODAY, '08:00'),
  endAt: at(TODAY, '09:30'),
  category: 'practice',
  status: 'in_progress',
  source: 'ai',
  timezone: 'Asia/Shanghai',
  notes: '',
  planId: 1,
  isRecurringInstance: false,
  deletedAt: null,
  linkedSessionId: 'sess-1',
  parentId: null,
  recurringExceptionDates: [],
  recurringParentId: null,
  recurringRule: null,
  targetId: 'tgt-1',
} as PlanEventReadV2;

const COMPACT: ReadonlyArray<CalendarCardProperty> = ['title', 'kind'];
const DEFAULT: ReadonlyArray<CalendarCardProperty> = ['title', 'kind', 'status'];
const DETAIL: ReadonlyArray<CalendarCardProperty> = [
  'title', 'kind', 'status', 'category', 'source', 'linkedSession', 'target',
];

function renderChip(props: Partial<ComponentProps<typeof MonthEventChip>> = {}) {
  return render(
    <MonthEventChip
      event={BASE_EVENT}
      visibleProperties={DEFAULT}
      today={TODAY}
      {...props}
    />,
  );
}

describe('MonthEventChip tone channel (§3.2)', () => {
  it('tags data-tone=today for an occurrence starting today', () => {
    renderChip();
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-tone', 'today');
  });

  it('tags data-tone=done and renders the ✓ check for a done event', () => {
    renderChip({ event: { ...BASE_EVENT, status: 'done' } });
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-tone', 'done');
    expect(screen.getByTestId('home-month-event-done')).toBeInTheDocument();
  });

  it('does not render the ✓ check for a non-done tone', () => {
    renderChip();
    expect(screen.queryByTestId('home-month-event-done')).toBeNull();
  });

  it('tags data-tone=skipped and strikes through the title', () => {
    renderChip({ event: { ...BASE_EVENT, status: 'skipped' } });
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-tone', 'skipped');
    expect(screen.getByTestId('home-month-event-title')).toHaveAttribute('data-skipped', 'true');
  });

  it('tags data-tone=overdue for a past, unfinished occurrence (no strikethrough)', () => {
    renderChip({
      event: { ...BASE_EVENT, status: 'planned', startAt: at('2026-05-20'), endAt: at('2026-05-21') },
    });
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-tone', 'overdue');
    expect(screen.getByTestId('home-month-event-title')).not.toHaveAttribute('data-skipped');
  });

  it('tags data-tone=future for an occurrence after today', () => {
    renderChip({
      event: { ...BASE_EVENT, status: 'planned', startAt: at('2026-05-28'), endAt: at('2026-05-28', '10:00') },
    });
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-tone', 'future');
  });
});

describe('MonthEventChip kind channel (§4.3 neutral leading icon)', () => {
  it('renders a neutral leading kind icon and exposes kind via data-kind', () => {
    renderChip({ visibleProperties: COMPACT });
    const chip = screen.getByTestId('home-month-event');
    expect(chip).toHaveAttribute('data-kind', 'practice');
    expect(screen.getByTestId('home-month-event-kind-icon')).toBeInTheDocument();
  });

  it('omits the kind icon when the kind channel is disabled', () => {
    renderChip({ visibleProperties: ['title'] });
    expect(screen.queryByTestId('home-month-event-kind-icon')).toBeNull();
  });

  it('renders the title text', () => {
    renderChip({ visibleProperties: COMPACT });
    expect(screen.getByTestId('home-month-event-title')).toHaveTextContent('言语·片段阅读');
  });
});

describe('MonthEventChip removed channels (§3.1 → Peek)', () => {
  it('does not render category / status dot / source / link / target on the chip', () => {
    renderChip({ visibleProperties: DETAIL });
    expect(screen.queryByTestId('home-month-event-category')).toBeNull();
    expect(screen.queryByLabelText('状态：进行中')).toBeNull();
    expect(screen.queryByLabelText('AI 排程')).toBeNull();
    expect(screen.queryByTestId('home-month-event-link')).toBeNull();
    expect(screen.queryByTestId('home-month-event-target')).toBeNull();
  });
});

describe('MonthEventChip cross-day (§3.2 slice anchor)', () => {
  it('marks data-cross-day for a partial slice', () => {
    const slice: CrossDaySlice = {
      occurrenceRef: 'e1:2026-05-27', day: '2026-05-27',
      sliceStartAt: at('2026-05-27', '00:00'), sliceEndAt: at('2026-05-27', '23:59'),
      isStartSlice: false, isEndSlice: false,
    };
    renderChip({ slice });
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-cross-day', 'true');
  });

  it('anchors tone on slice.day (future cell of a multi-day occurrence)', () => {
    const slice: CrossDaySlice = {
      occurrenceRef: 'e1:2026-05-28', day: '2026-05-28',
      sliceStartAt: at('2026-05-28', '00:00'), sliceEndAt: at('2026-05-28', '12:00'),
      isStartSlice: false, isEndSlice: true,
    };
    renderChip({
      event: { ...BASE_EVENT, status: 'planned', startAt: at('2026-05-25'), endAt: at('2026-05-28', '12:00') },
      slice,
    });
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-tone', 'future');
  });

  it('omits data-cross-day when the slice is single-day', () => {
    const slice: CrossDaySlice = {
      occurrenceRef: 'e1:2026-05-26', day: TODAY,
      sliceStartAt: at(TODAY, '08:00'), sliceEndAt: at(TODAY, '09:30'),
      isStartSlice: true, isEndSlice: true,
    };
    renderChip({ slice });
    expect(screen.getByTestId('home-month-event')).not.toHaveAttribute('data-cross-day');
  });
});

describe('MonthEventChip anchors / optimistic (SIK-139 contract unchanged)', () => {
  it('exposes the real event id via data-event-id', () => {
    renderChip();
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-event-id', 'e1');
  });

  it('uses peekAnchorId for data-peek-anchor when provided', () => {
    renderChip({ peekAnchorId: 'e1:2026-05-27|2026-05-27' });
    expect(screen.getByTestId('home-month-event')).toHaveAttribute(
      'data-peek-anchor', 'e1:2026-05-27|2026-05-27',
    );
  });

  it('falls back to the event id for data-peek-anchor', () => {
    renderChip();
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-peek-anchor', 'e1');
  });

  it('merges optimisticPatch over the source event for rendering', () => {
    renderChip({
      visibleProperties: ['title', 'kind'],
      optimisticPatch: { title: '言语·乐观改期预览', status: 'done' },
    });
    expect(screen.getByTestId('home-month-event-title')).toHaveTextContent('言语·乐观改期预览');
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-tone', 'done');
  });

  it('renders the source event unchanged when optimisticPatch is undefined', () => {
    renderChip({ visibleProperties: ['title', 'kind'] });
    expect(screen.getByTestId('home-month-event-title')).toHaveTextContent('言语·片段阅读');
  });
});
