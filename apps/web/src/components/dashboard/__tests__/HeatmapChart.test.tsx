import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeatmapChart } from '../HeatmapChart';
import type { HeatmapEntryV2 } from '@sikao/api-client/types/api';

describe('HeatmapChart', () => {
  it('renders compact empty state when entries contain no practice data', () => {
    const entries: HeatmapEntryV2[] = [
      { date: '2026-05-08', count: 0, rate: 0 },
      { date: '2026-05-09', count: 0, rate: 0 },
      { date: '2026-05-10', count: 0, rate: 0 },
    ];

    render(<HeatmapChart entries={entries} />);

    expect(screen.getByTestId('heatmap-chart-empty')).toBeInTheDocument();
    expect(screen.getByText('暂无练习记录, 答过题后热力图会出现在这里。')).toBeInTheDocument();
    expect(screen.queryByTestId('heatmap-chart')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('2026-05-08 · 0 题 · 正确率 0%')).not.toBeInTheDocument();
  });

  it('renders the heatmap grid when at least one entry has practice data', () => {
    const entries: HeatmapEntryV2[] = [
      { date: '2026-05-08', count: 0, rate: 0 },
      { date: '2026-05-09', count: 3, rate: 0.67 },
    ];

    render(<HeatmapChart entries={entries} />);

    expect(screen.getByTestId('heatmap-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('heatmap-chart-empty')).not.toBeInTheDocument();
    expect(screen.getByLabelText('2026-05-09 · 3 题 · 正确率 67%')).toBeInTheDocument();
  });
});
