/*
 * EventBlock tests — SIK-90 Home M-A wave 3 (2026-05-24).
 * Cover the data-attr contract (category / status / density) consumers
 * rely on for visual modifiers, plus the time slot.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
import { EventBlock } from './EventBlock';

const BASE_EVENT = {
  id: 'e1', title: '言语 30 题',
  startAt: '2026-05-24T08:00:00+08:00',
  endAt: '2026-05-24T10:00:00+08:00',
  category: 'yanyu', status: 'planned', source: 'manual',
  timezone: 'Asia/Shanghai', notes: '', planId: 1, isRecurringInstance: false,
  deletedAt: null, linkedSessionId: null, parentId: null,
  recurringExceptionDates: [], recurringParentId: null, recurringRule: null, targetId: null,
} as const satisfies PlanEventReadV2;

describe('EventBlock', () => {
  it('exposes title and time slot', () => {
    render(<EventBlock event={BASE_EVENT} style={{}} testId="e" />);
    expect(screen.getByText('言语 30 题')).toBeInTheDocument();
    expect(screen.getByText('08:00 – 10:00')).toBeInTheDocument();
  });

  it('forwards category / status data-attrs for CSS modifier hooks', () => {
    render(<EventBlock event={{ ...BASE_EVENT, category: 'mock', status: 'done' }} style={{}} testId="e" />);
    const node = screen.getByTestId('e');
    expect(node).toHaveAttribute('data-category', 'mock');
    expect(node).toHaveAttribute('data-status', 'done');
  });

  it('omits data-density by default; sets it when density="compact"', () => {
    const { rerender } = render(<EventBlock event={BASE_EVENT} style={{}} testId="e" />);
    expect(screen.getByTestId('e')).not.toHaveAttribute('data-density');
    rerender(<EventBlock event={BASE_EVENT} style={{}} density="compact" testId="e" />);
    expect(screen.getByTestId('e')).toHaveAttribute('data-density', 'compact');
  });
});
