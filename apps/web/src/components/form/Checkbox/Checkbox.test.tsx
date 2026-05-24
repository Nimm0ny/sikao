import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('sets the native indeterminate property when checked === "indeterminate"', () => {
    render(<Checkbox checked="indeterminate" onChange={() => {}} label="Mixed" />);
    const input = screen.getByLabelText('Mixed') as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
    expect(input.getAttribute('aria-checked')).toBe('mixed');
  });

  it('fires onChange(true) when an unchecked box is clicked', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Accept" />);
    fireEvent.click(screen.getByLabelText('Accept'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('binds label to the underlying input via wrapping <label>', () => {
    render(<Checkbox checked onChange={() => {}} label="Subscribe" />);
    const input = screen.getByLabelText('Subscribe') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.type).toBe('checkbox');
    expect(input.checked).toBe(true);
  });

  it('renders without label and is still operable', () => {
    const onChange = vi.fn();
    const { container } = render(<Checkbox checked={false} onChange={onChange} />);
    const input = container.querySelector('input[type=checkbox]') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
