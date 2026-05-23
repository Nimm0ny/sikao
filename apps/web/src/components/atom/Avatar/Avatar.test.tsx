import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders an <img> when `src` is provided', () => {
    render(<Avatar src="https://example.test/a.png" fallback="L" alt="Li Ming" />);
    const img = screen.getByRole('img', { name: 'Li Ming' }) as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('https://example.test/a.png');
  });

  it('falls back to initials when `src` errors out', () => {
    render(<Avatar src="https://example.test/missing.png" fallback="LM" alt="Li Ming" />);
    const img = screen.getByRole('img', { name: 'Li Ming' }) as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.getByText('LM')).toBeInTheDocument();
  });

  it('renders a status dot when `status` is provided', () => {
    render(<Avatar fallback="L" status="online" />);
    const dot = screen.getByTestId('avatar-status-dot');
    expect(dot.dataset.status).toBe('online');
  });
});
