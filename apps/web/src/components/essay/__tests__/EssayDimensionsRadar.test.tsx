import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EssayDimensionsRadar } from '../EssayDimensionsRadar';
import type { EssayDimensionV2 } from '@sikao/api-client/types/api';

const FIVE_DIMS: EssayDimensionV2[] = [
  { name: '论点准确', weight: 0.3, score: 8, comment: '...' },
  { name: '材料运用', weight: 0.25, score: 7, comment: '...' },
  { name: '语言', weight: 0.2, score: 6, comment: '...' },
  { name: '结构', weight: 0.15, score: 9, comment: '...' },
  { name: '字数符合度', weight: 0.1, score: 10, comment: '...' },
];

describe('EssayDimensionsRadar', () => {
  it('renders polygon with 5 data points + 5 labels for 5 dims', () => {
    render(<EssayDimensionsRadar dimensions={FIVE_DIMS} />);
    expect(screen.getByTestId('essay-radar')).toBeInTheDocument();
    expect(screen.getByTestId('essay-radar-polygon')).toBeInTheDocument();
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`essay-radar-point-${i}`)).toBeInTheDocument();
      expect(screen.getByTestId(`essay-radar-label-${i}`)).toBeInTheDocument();
    }
    // 5 维度名都展示
    for (const d of FIVE_DIMS) {
      expect(screen.getByText(d.name)).toBeInTheDocument();
    }
  });

  it('clamps score to [0, 10]: out-of-range scores do not break polygon', () => {
    const odd: EssayDimensionV2[] = [
      { name: 'a', weight: 0.2, score: -3, comment: '' }, // < 0
      { name: 'b', weight: 0.2, score: 0, comment: '' },
      { name: 'c', weight: 0.2, score: 5, comment: '' },
      { name: 'd', weight: 0.2, score: 10, comment: '' },
      { name: 'e', weight: 0.2, score: 99, comment: '' }, // > 10
    ];
    render(<EssayDimensionsRadar dimensions={odd} />);
    const polygon = screen.getByTestId('essay-radar-polygon');
    const points = polygon.getAttribute('points') ?? '';
    // 5 点
    expect(points.split(' ')).toHaveLength(5);
    // 不含 NaN / Infinity
    expect(points).not.toMatch(/NaN|Infinity/);
  });

  it('renders empty placeholder when fewer than 3 dims (would be degenerate)', () => {
    render(<EssayDimensionsRadar dimensions={[]} />);
    expect(screen.getByTestId('essay-radar-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('essay-radar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('essay-radar-polygon')).not.toBeInTheDocument();
  });

  it('point at score=10 sits on outer ring (ratio 1.0); score=0 sits at center', () => {
    const edge: EssayDimensionV2[] = [
      { name: 'top', weight: 0.33, score: 10, comment: '' }, // i=0, angle=0 → top
      { name: 'mid', weight: 0.33, score: 0, comment: '' },  // ratio=0 → center
      { name: 'three', weight: 0.34, score: 5, comment: '' },
    ];
    render(<EssayDimensionsRadar dimensions={edge} />);
    // circle cx/cy 是 number prop, React 渲染时不保留小数 (polygonPoints
    // 才走 toFixed(2)). i=0: angle 0, ratio 1 → x=center=120, y=120-90=30 (top).
    const p0 = screen.getByTestId('essay-radar-point-0');
    expect(p0.getAttribute('cx')).toBe('120');
    expect(p0.getAttribute('cy')).toBe('30');
    // i=1: ratio=0 → 直接落在 center.
    const p1 = screen.getByTestId('essay-radar-point-1');
    expect(p1.getAttribute('cx')).toBe('120');
    expect(p1.getAttribute('cy')).toBe('120');
  });
});
