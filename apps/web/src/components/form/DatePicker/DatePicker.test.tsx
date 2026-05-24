import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePicker } from './DatePicker';
import type { DatePickerPreset } from './DatePicker';

/*
 * DatePicker tests — V5 D.3.14 form atom.
 * Why: cover trigger formatting, panel open / pick / preset paths, format
 *      whitelist, and min/max range gating. Calendar grid is a 6×7 ISO Mon-
 *      start layout so the grid query stays stable across months.
 */

describe('DatePicker', () => {
  it('formats value using YYYY-MM-DD by default and shows placeholder when null', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DatePicker value={null} onChange={onChange} placeholder="选日期" />,
    );
    expect(screen.getByRole('button', { name: '选日期' })).toHaveTextContent('选日期');

    rerender(<DatePicker value={new Date(2026, 4, 12)} onChange={onChange} />);
    // Trigger label reflects formatted value; aria-label stays the placeholder default.
    expect(screen.getByText('2026-05-12')).toBeInTheDocument();
  });

  it('opens calendar panel on trigger click and closes it after picking a day', () => {
    const onChange = vi.fn();
    render(<DatePicker value={new Date(2026, 4, 12)} onChange={onChange} />);
    // trigger button uses placeholder as aria-label (default)
    const trigger = screen.getByRole('button', { name: '选择日期' });
    fireEvent.click(trigger);
    expect(screen.getByTestId('datepicker-panel')).toBeInTheDocument();

    // 5 月 15 号必在 6×7 grid 内（无论 ISO Mon-start 怎么填充）
    const day15 = screen.getByRole('button', { name: '2026-05-15' });
    fireEvent.click(day15);
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0] as Date;
    expect(arg.getFullYear()).toBe(2026);
    expect(arg.getMonth()).toBe(4);
    expect(arg.getDate()).toBe(15);
  });

  it('invokes onChange with preset value when a preset chip is clicked', () => {
    const onChange = vi.fn();
    const fixed = new Date(2026, 4, 1);
    const presets: DatePickerPreset[] = [
      { label: '固定日', value: fixed },
    ];
    render(<DatePicker value={null} onChange={onChange} presets={presets} placeholder="选日期" />);
    fireEvent.click(screen.getByRole('button', { name: '选日期' }));
    fireEvent.click(screen.getByRole('button', { name: '固定日' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0] as Date;
    expect(arg.getTime()).toBe(new Date(2026, 4, 1).getTime());
  });

  it('disables out-of-range cells via min / max', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value={new Date(2026, 4, 15)}
        onChange={onChange}
        min={new Date(2026, 4, 10)}
        max={new Date(2026, 4, 20)}
      />,
    );
    // open the panel via the trigger (aria-label defaults to placeholder)
    fireEvent.click(screen.getByRole('button', { name: '选择日期' }));
    // 5 月 5 号在 min=10 之前
    const dayOutBefore = screen.getByRole('button', { name: '2026-05-05' });
    expect(dayOutBefore).toBeDisabled();
    // 5 月 25 号在 max=20 之后
    const dayOutAfter = screen.getByRole('button', { name: '2026-05-25' });
    expect(dayOutAfter).toBeDisabled();
    // 5 月 15 号在范围内
    const dayIn = screen.getByRole('button', { name: '2026-05-15' });
    expect(dayIn).not.toBeDisabled();
  });

  it('applies the chosen format string to the trigger label', () => {
    const onChange = vi.fn();
    const value = new Date(2026, 4, 12);
    const { rerender } = render(<DatePicker value={value} onChange={onChange} format="YYYY/MM/DD" />);
    expect(screen.getByText('2026/05/12')).toBeInTheDocument();
    rerender(<DatePicker value={value} onChange={onChange} format="MM/DD" />);
    expect(screen.getByText('05/12')).toBeInTheDocument();
  });
});
