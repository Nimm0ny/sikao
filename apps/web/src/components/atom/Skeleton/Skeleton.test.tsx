import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a single placeholder block by default', () => {
    const { container } = render(<Skeleton width={120} height={16} />);
    const block = container.firstElementChild as HTMLElement;
    expect(block.dataset.variant).toBe('rect');
    expect(block.style.width).toBe('120px');
    expect(block.style.height).toBe('16px');
  });

  it('emits N text stubs and trims the last to 60% width', () => {
    render(<Skeleton variant="text" lines={3} />);
    const group = screen.getByTestId('skeleton-text-group');
    const lines = group.querySelectorAll('[data-variant="text"]');
    expect(lines.length).toBe(3);
    const last = lines[lines.length - 1] as HTMLElement;
    expect(last.style.width).toBe('60%');
  });

  it('throws when lines is not a positive integer', () => {
    expect(() => render(<Skeleton variant="text" lines={0} />)).toThrow(/positive integer/);
  });
});
