/*
 * MonthEventChip tests — SIK-138 W5.
 *
 * Why: visual contract §3 locks 7 visible-property channels to disjoint
 *      visual encodings. This suite verifies each channel renders only
 *      when its property name is present in `visibleProperties`, and that
 *      the data-attr surface (kind / status / cross-day) consumers will
 *      style against stays stable.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
import type { CrossDaySlice } from '@sikao/calendar-engine';

import { MonthEventChip } from './MonthEventChip';
import type { CalendarCardProperty } from './calendarViewConfig';

const BASE_EVENT: PlanEventReadV2 = {
  id: 'e1',
  title: '言语·片段阅读',
  startAt: '2026-05-26T08:00:00+08:00',
  endAt: '2026-05-26T09:30:00+08:00',
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

describe('MonthEventChip channels', () => {
  it('compact preset shows title only and exposes kind via data-kind', () => {
    render(<MonthEventChip event={BASE_EVENT} visibleProperties={COMPACT} />);
    const chip = screen.getByTestId('home-month-event');
    expect(chip).toHaveAttribute('data-kind', 'practice');
    expect(screen.getByTestId('home-month-event-title')).toHaveTextContent('言语·片段阅读');
    expect(screen.queryByTestId('home-month-event-category')).toBeNull();
    expect(screen.queryByTestId('home-month-event-link')).toBeNull();
    expect(screen.queryByTestId('home-month-event-target')).toBeNull();
  });

  it('default preset adds the status dot but no source / link / target icons', () => {
    render(<MonthEventChip event={BASE_EVENT} visibleProperties={DEFAULT} />);
    expect(screen.getByLabelText('状态：进行中')).toBeInTheDocument();
    expect(screen.queryByLabelText('AI 排程')).toBeNull();
    expect(screen.queryByTestId('home-month-event-link')).toBeNull();
    expect(screen.queryByTestId('home-month-event-target')).toBeNull();
  });

  it('detail preset surfaces every channel that has a value', () => {
    render(<MonthEventChip event={BASE_EVENT} visibleProperties={DETAIL} />);
    expect(screen.getByTestId('home-month-event-title')).toBeInTheDocument();
    expect(screen.getByTestId('home-month-event-category')).toHaveTextContent('practice');
    expect(screen.getByLabelText('状态：进行中')).toBeInTheDocument();
    expect(screen.getByLabelText('AI 排程')).toBeInTheDocument();
    expect(screen.getByTestId('home-month-event-link')).toBeInTheDocument();
    expect(screen.getByTestId('home-month-event-target')).toHaveTextContent('T');
  });

  it('hides linkedSession / target icons when the underlying ID is null', () => {
    render(
      <MonthEventChip
        event={{ ...BASE_EVENT, linkedSessionId: null, targetId: null }}
        visibleProperties={DETAIL}
      />,
    );
    expect(screen.queryByTestId('home-month-event-link')).toBeNull();
    expect(screen.queryByTestId('home-month-event-target')).toBeNull();
  });

  it('renders the right source icon for each known source value', () => {
    const sources: ReadonlyArray<{ s: PlanEventReadV2['source']; label: string }> = [
      { s: 'ai', label: 'AI 排程' },
      { s: 'manual', label: '人工创建' },
      { s: 'import', label: '外部导入' },
    ];
    for (const { s, label } of sources) {
      const { unmount } = render(
        <MonthEventChip event={{ ...BASE_EVENT, source: s }} visibleProperties={DETAIL} />,
      );
      expect(screen.getByLabelText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('does not render a source icon for an unknown source value (fail-fast intent)', () => {
    render(
      <MonthEventChip
        event={{ ...BASE_EVENT, source: 'mystery' }}
        visibleProperties={DETAIL}
      />,
    );
    expect(screen.queryByLabelText('AI 排程')).toBeNull();
    expect(screen.queryByLabelText('人工创建')).toBeNull();
    expect(screen.queryByLabelText('外部导入')).toBeNull();
  });

  it('marks cross-day chips via data-cross-day when the slice is partial', () => {
    const slice: CrossDaySlice = {
      occurrenceRef: 'e1:2026-05-27',
      day: '2026-05-27',
      sliceStartAt: '2026-05-27T00:00:00+08:00',
      sliceEndAt: '2026-05-27T23:59:59+08:00',
      isStartSlice: false,
      isEndSlice: false,
    };
    render(
      <MonthEventChip event={BASE_EVENT} visibleProperties={DEFAULT} slice={slice} />,
    );
    expect(screen.getByTestId('home-month-event')).toHaveAttribute('data-cross-day', 'true');
  });

  it('omits data-cross-day when the slice is single-day', () => {
    const slice: CrossDaySlice = {
      occurrenceRef: 'e1:2026-05-26',
      day: '2026-05-26',
      sliceStartAt: '2026-05-26T08:00:00+08:00',
      sliceEndAt: '2026-05-26T09:30:00+08:00',
      isStartSlice: true,
      isEndSlice: true,
    };
    render(
      <MonthEventChip event={BASE_EVENT} visibleProperties={DEFAULT} slice={slice} />,
    );
    expect(screen.getByTestId('home-month-event')).not.toHaveAttribute('data-cross-day');
  });

  it('renders status dot label for every locked status value', () => {
    const statuses: ReadonlyArray<{ status: string; label: string }> = [
      { status: 'planned', label: '待办' },
      { status: 'in_progress', label: '进行中' },
      { status: 'done', label: '已完成' },
      { status: 'skipped', label: '跳过' },
    ];
    for (const { status, label } of statuses) {
      const { unmount } = render(
        <MonthEventChip
          event={{ ...BASE_EVENT, status }}
          visibleProperties={DEFAULT}
        />,
      );
      expect(screen.getByLabelText(`状态：${label}`)).toBeInTheDocument();
      unmount();
    }
  });
});
