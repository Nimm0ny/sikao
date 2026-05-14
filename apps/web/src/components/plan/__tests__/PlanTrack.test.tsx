import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanTrack } from '../PlanTrack';

const baseProps = {
  weekNum: 14,
  dateRangeLabel: 'May 5 — May 11',
  days: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-05-0${i + 5}`,
    dayLabel: `D · ${i + 5}`,
    status: 'future' as const,
    tasks: [],
  })),
};

describe('PlanTrack', () => {
  it('渲 weekNum + dateRange + 7 day grid', () => {
    render(<PlanTrack {...baseProps} />);
    expect(screen.getByTestId('plan-track')).toHaveAttribute('data-week', '14');
    expect(screen.getByTestId('plan-track-week-num')).toHaveTextContent('第 14 周');
    expect(screen.getByTestId('plan-track-week-range')).toHaveTextContent(
      'May 5 — May 11',
    );
    expect(screen.getAllByTestId('plan-day').length).toBe(7);
  });

  it('days 内不同 status 透传到 PlanDay', () => {
    render(
      <PlanTrack
        {...baseProps}
        days={[
          {
            date: '2026-05-05',
            dayLabel: 'M · 5',
            status: 'done',
            tasks: [],
          },
          {
            date: '2026-05-09',
            dayLabel: 'F · 9',
            status: 'today',
            tasks: [],
          },
        ]}
      />,
    );
    const days = screen.getAllByTestId('plan-day');
    expect(days[0]).toHaveAttribute('data-status', 'done');
    expect(days[1]).toHaveAttribute('data-status', 'today');
  });
});
