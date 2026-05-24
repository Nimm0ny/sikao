import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TimePicker } from './TimePicker';

/*
 * TimePicker tests — V5 D.3.14 form atom.
 * Why: cover trigger formatting under both 24h / 12h, step-driven minute
 *      list filtering, hour + minute pick paths, and AM/PM toggle in 12h
 *      mode. Trigger uses role="combobox" so we open the panel via that
 *      role instead of by aria-label.
 */

describe('TimePicker', () => {
  it('formats trigger label as HH:mm in 24h mode and HH:mm AM/PM in 12h mode', () => {
    const onChange = vi.fn();
    const { rerender } = render(<TimePicker value={{ h: 14, m: 30 }} onChange={onChange} />);
    expect(screen.getByText('14:30')).toBeInTheDocument();

    rerender(<TimePicker value={{ h: 14, m: 30 }} onChange={onChange} format="12h" />);
    expect(screen.getByText('02:30 PM')).toBeInTheDocument();

    rerender(<TimePicker value={{ h: 0, m: 5 }} onChange={onChange} format="12h" />);
    expect(screen.getByText('12:05 AM')).toBeInTheDocument();

    rerender(<TimePicker value={null} onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: '选择时间' })).toHaveTextContent('选择时间');
  });

  it('filters the minute column to [0,15,30,45] when step=15 (default)', () => {
    const onChange = vi.fn();
    render(<TimePicker value={{ h: 9, m: 0 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox', { name: '选择时间' }));
    const minuteList = screen.getByRole('listbox', { name: '分钟' });
    const opts = within(minuteList).getAllByRole('option');
    expect(opts).toHaveLength(4);
    expect(opts.map((b) => b.textContent)).toEqual(['00', '15', '30', '45']);
  });

  it('invokes onChange when picking either hour or minute', () => {
    const onChange = vi.fn();
    render(<TimePicker value={{ h: 9, m: 0 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox', { name: '选择时间' }));
    const hourList = screen.getByRole('listbox', { name: '小时' });
    fireEvent.click(within(hourList).getByRole('option', { name: '11' }));
    expect(onChange).toHaveBeenLastCalledWith({ h: 11, m: 0 });

    const minuteList = screen.getByRole('listbox', { name: '分钟' });
    fireEvent.click(within(minuteList).getByRole('option', { name: '45' }));
    expect(onChange).toHaveBeenLastCalledWith({ h: 9, m: 45 });
  });

  it('toggles AM/PM in 12h mode and shifts the hour by 12', () => {
    const onChange = vi.fn();
    // value is 02:30 PM (h=14)
    render(<TimePicker value={{ h: 14, m: 30 }} onChange={onChange} format="12h" />);
    fireEvent.click(screen.getByRole('combobox', { name: '选择时间' }));
    const am = screen.getByRole('button', { name: 'AM' });
    fireEvent.click(am);
    expect(onChange).toHaveBeenCalledWith({ h: 2, m: 30 });
  });

  it('does not open the panel when disabled', () => {
    const onChange = vi.fn();
    render(<TimePicker value={null} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('combobox', { name: '选择时间' }));
    expect(screen.queryByTestId('timepicker-panel')).toBeNull();
  });
});
