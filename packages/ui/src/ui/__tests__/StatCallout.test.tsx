import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCallout } from '../StatCallout';

// SIKAO Phase 1D: trend prop sparkline.
// Spec: design/SIKAO/handoff/specs/01-dashboard.md 行 14, 24.

describe('StatCallout', () => {
  it('renders label + value without trend by default (backward compat)', () => {
    render(<StatCallout label="累计答题" value={123} />);
    expect(screen.getByText('累计答题')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.queryByTestId('stat-callout-sparkline')).toBeNull();
  });

  it('hairline=false omits border + bg classes', () => {
    const { container } = render(
      <StatCallout label="x" value={1} hairline={false} data-testid="sc" />,
    );
    const root = container.querySelector('[data-testid="sc"]');
    expect(root).not.toBeNull();
    expect(root!).not.toHaveClass('border', 'border-line', 'bg-surface');
  });

  it('trend with 7 points renders sparkline svg with polyline', () => {
    render(
      <StatCallout
        label="行测"
        value={67}
        unit="%"
        trend={[40, 55, 50, 60, 58, 65, 67]}
      />,
    );
    const svg = screen.getByTestId('stat-callout-sparkline');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    const polyline = svg.querySelector('polyline');
    expect(polyline).not.toBeNull();
    const points = polyline!.getAttribute('points')!;
    // 7 points = 6 spaces.
    expect(points.split(' ')).toHaveLength(7);
    // 第一点 x=0; 最后点 x=60.
    expect(points.split(' ')[0]).toMatch(/^0\.00,/);
    expect(points.split(' ')[6]).toMatch(/^60\.00,/);
    // stroke 走 currentColor token, 不 hardcode.
    expect(polyline).toHaveAttribute('stroke', 'currentColor');
  });

  it('trend length < 2 does NOT render sparkline (single point not a trend)', () => {
    render(<StatCallout label="x" value={1} trend={[42]} />);
    expect(screen.queryByTestId('stat-callout-sparkline')).toBeNull();
  });

  it('trend length 0 does NOT render sparkline', () => {
    render(<StatCallout label="x" value={1} trend={[]} />);
    expect(screen.queryByTestId('stat-callout-sparkline')).toBeNull();
  });

  it('trend with all-same values degrades to flat line at y=8 (avoid div-by-zero)', () => {
    render(<StatCallout label="x" value={1} trend={[5, 5, 5, 5, 5, 5, 5]} />);
    const polyline = screen
      .getByTestId('stat-callout-sparkline')
      .querySelector('polyline')!;
    const points = polyline.getAttribute('points')!.split(' ');
    // 全部 y = SPARK_HEIGHT/2 = 8.
    points.forEach((p) => {
      expect(p.split(',')[1]).toBe('8.00');
    });
  });

  it('trend with all zeros degrades to flat line (no NaN)', () => {
    render(<StatCallout label="x" value={1} trend={[0, 0, 0, 0, 0, 0, 0]} />);
    const polyline = screen
      .getByTestId('stat-callout-sparkline')
      .querySelector('polyline')!;
    const points = polyline.getAttribute('points')!;
    expect(points).not.toContain('NaN');
    points.split(' ').forEach((p) => {
      expect(p.split(',')[1]).toBe('8.00');
    });
  });

  it('trend with two points renders sparkline (boundary case)', () => {
    render(<StatCallout label="x" value={1} trend={[10, 20]} />);
    const svg = screen.getByTestId('stat-callout-sparkline');
    const polyline = svg.querySelector('polyline')!;
    const points = polyline.getAttribute('points')!.split(' ');
    expect(points).toHaveLength(2);
    // 第一点 x=0, 最低值 -> y=16; 第二点 x=60, 最高值 -> y=0.
    expect(points[0]).toBe('0.00,16.00');
    expect(points[1]).toBe('60.00,0.00');
  });
});
