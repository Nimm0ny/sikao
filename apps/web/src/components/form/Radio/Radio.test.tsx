import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Radio } from './Radio';

describe('Radio', () => {
  it('groups multiple radios under same name and only one stays checked', () => {
    const onChange = vi.fn();
    render(
      <>
        <Radio name="grp" value="a" checked={false} onChange={onChange} label="A" />
        <Radio name="grp" value="b" checked onChange={onChange} label="B" />
      </>,
    );
    const a = screen.getByLabelText('A') as HTMLInputElement;
    const b = screen.getByLabelText('B') as HTMLInputElement;
    expect(a.name).toBe('grp');
    expect(b.name).toBe('grp');
    expect(b.checked).toBe(true);
    expect(a.checked).toBe(false);
  });

  it('fires onChange(value) when an unchecked radio is clicked', () => {
    const onChange = vi.fn();
    render(<Radio name="g" value="apple" checked={false} onChange={onChange} label="Apple" />);
    fireEvent.click(screen.getByLabelText('Apple'));
    expect(onChange).toHaveBeenCalledWith('apple');
  });

  it('does not fire onChange when disabled is set', () => {
    const onChange = vi.fn();
    render(<Radio name="g" value="x" checked={false} onChange={onChange} label="X" disabled />);
    const input = screen.getByLabelText('X');
    fireEvent.click(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toBeDisabled();
  });
});
