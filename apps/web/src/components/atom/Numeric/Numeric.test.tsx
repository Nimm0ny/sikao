import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Numeric } from './Numeric';

describe('Numeric', () => {
  it('formats with thousand separator and precision by default', () => {
    render(<Numeric value={12345} precision={2} />);
    expect(screen.getByText('12,345.00')).toBeInTheDocument();
  });

  it('disables thousand separator when thousand=false', () => {
    render(<Numeric value={12345} thousand={false} />);
    expect(screen.getByText('12345')).toBeInTheDocument();
  });

  it('renders trend glyph + state token mapping', () => {
    render(<Numeric value={42} trend="up" />);
    const root = screen.getByText('42').parentElement as HTMLElement;
    expect(root.dataset.trend).toBe('up');
    expect(root.querySelector('[aria-hidden="true"]')?.textContent).toBe('▲');
  });

  it('throws on non-finite numeric input', () => {
    expect(() => render(<Numeric value={Number.NaN} />)).toThrow(/finite/);
  });
});
