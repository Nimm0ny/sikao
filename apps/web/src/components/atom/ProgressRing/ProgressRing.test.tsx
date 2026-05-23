import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressRing } from './ProgressRing';

describe('ProgressRing', () => {
  it('renders an SVG with two circles', () => {
    const { container } = render(<ProgressRing value={50} size="md" />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  it('computes strokeDashoffset = c * (1 - value/100)', () => {
    render(<ProgressRing value={75} size="md" strokeWidth={4} />);
    // size md => 40px; r = (40 - 4) / 2 = 18; c = 2π*18 ≈ 113.097
    const indicator = screen.getByTestId('progress-ring-indicator') as SVGCircleElement;
    const dasharray = parseFloat(indicator.getAttribute('stroke-dasharray') ?? '0');
    const offset = parseFloat(indicator.getAttribute('stroke-dashoffset') ?? '0');
    expect(Math.abs(dasharray - 2 * Math.PI * 18)).toBeLessThan(0.001);
    expect(Math.abs(offset - dasharray * 0.25)).toBeLessThan(0.001);
  });

  it('renders children inside the centered overlay', () => {
    render(
      <ProgressRing value={42} size="lg">
        <span data-testid="ring-label">42%</span>
      </ProgressRing>,
    );
    const overlay = screen.getByTestId('progress-ring-center');
    expect(overlay).toContainElement(screen.getByTestId('ring-label'));
  });
});
