import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './Switch';

describe('Switch', () => {
  it('exposes role="switch" and reports aria-checked', () => {
    render(<Switch checked onChange={() => {}} label="深色" />);
    const input = screen.getByRole('switch', { name: '深色' });
    expect(input.getAttribute('aria-checked')).toBe('true');
  });

  it('toggles via keyboard Space (native checkbox behavior)', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="开" />);
    const input = screen.getByRole('switch', { name: '开' });
    // Native checkbox toggles on space → fires `change`. Simulate the click
    // event the browser dispatches on Space-key activation.
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire onChange when disabled', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="x" disabled />);
    const input = screen.getByRole('switch', { name: 'x' });
    fireEvent.click(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toBeDisabled();
  });
});
