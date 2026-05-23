import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressLinear } from './ProgressLinear';

describe('ProgressLinear', () => {
  it('exposes aria-valuenow and a fill width matching the value', () => {
    render(<ProgressLinear value={80} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('80');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    const fill = screen.getByTestId('progress-linear-fill') as HTMLElement;
    expect(fill.style.width).toBe('80%');
  });

  it('omits aria-valuenow and marks busy in indeterminate mode', () => {
    render(<ProgressLinear value={50} indeterminate />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
    expect(bar.getAttribute('aria-busy')).toBe('true');
    expect(bar.dataset.indeterminate).toBe('true');
  });

  it('clamps value to 0-100 range and renders label when requested', () => {
    render(<ProgressLinear value={142} showLabel />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByTestId('progress-linear-label').textContent).toBe('100%');
  });
});
