import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatStrip } from '../StatStrip';

describe('StatStrip', () => {
  it('正常 totals → 4 格 + serif 大数字', () => {
    render(
      <StatStrip
        totals={{
          practiced: 187,
          total: 2337,
          streakDays: 14,
          weekDone: 23,
          avgScore: 38.4,
        }}
      />,
    );
    expect(screen.getByTestId('essay-specialty-stat-practiced')).toHaveTextContent(
      '187',
    );
    expect(screen.getByTestId('essay-specialty-stat-practiced')).toHaveTextContent(
      '/2337',
    );
    expect(screen.getByTestId('essay-specialty-stat-streak')).toHaveTextContent(
      '14',
    );
    expect(screen.getByTestId('essay-specialty-stat-avg')).toHaveTextContent(
      '38.4',
    );
  });

  it('avgScore=0 → 显示 "—"', () => {
    render(
      <StatStrip
        totals={{
          practiced: 0,
          total: 2000,
          streakDays: 0,
          weekDone: 0,
          avgScore: 0,
        }}
      />,
    );
    expect(screen.getByTestId('essay-specialty-stat-avg')).toHaveTextContent(
      '—',
    );
  });
});
