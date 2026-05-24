import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Select } from './Select';

const OPTIONS = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
] as const;

function Harness({
  initialValue = '' as string,
  searchable,
  clearable,
  onChangeSpy,
}: {
  initialValue?: string;
  searchable?: boolean;
  clearable?: boolean;
  onChangeSpy?: (v: string) => void;
}) {
  const [value, setValue] = useState<string>(initialValue);
  return (
    <Select<string>
      value={value}
      onChange={(v) => {
        setValue(v ?? '');
        onChangeSpy?.(v);
      }}
      options={[...OPTIONS]}
      searchable={searchable}
      clearable={clearable}
      aria-label="难度"
    />
  );
}

describe('Select', () => {
  it('opens the panel when the trigger is clicked', () => {
    render(<Harness />);
    const trigger = screen.getByRole('combobox', { name: '难度' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('option', { name: '简单' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '中等' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '困难' })).toBeInTheDocument();
  });

  it('fires onChange and closes the panel when an option is clicked', () => {
    const onChange = vi.fn();
    render(<Harness onChangeSpy={onChange} />);
    fireEvent.click(screen.getByRole('combobox', { name: '难度' }));
    fireEvent.click(screen.getByRole('option', { name: '中等' }));
    expect(onChange).toHaveBeenCalledWith('medium');
    // After selection the panel closes — option is no longer in the DOM.
    expect(screen.queryByRole('option', { name: '中等' })).toBeNull();
  });

  it('searchable mode filters options by label substring', () => {
    render(<Harness searchable />);
    fireEvent.click(screen.getByRole('combobox', { name: '难度' }));
    const search = screen.getByLabelText('搜索选项');
    fireEvent.change(search, { target: { value: '困' } });
    expect(screen.getByRole('option', { name: '困难' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '简单' })).toBeNull();
    expect(screen.queryByRole('option', { name: '中等' })).toBeNull();
  });

  it('searchable mode shows "无结果" when nothing matches', () => {
    render(<Harness searchable />);
    fireEvent.click(screen.getByRole('combobox', { name: '难度' }));
    fireEvent.change(screen.getByLabelText('搜索选项'), {
      target: { value: 'xxx' },
    });
    expect(screen.getByTestId('select-empty').textContent).toBe('无结果');
  });

  it('clearable button resets the value to undefined', () => {
    const onChange = vi.fn();
    render(<Harness initialValue="medium" clearable onChangeSpy={onChange} />);
    const clear = screen.getByRole('button', { name: '清空' });
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('Esc inside searchable mode closes the panel', () => {
    render(<Harness searchable />);
    const trigger = screen.getByRole('combobox', { name: '难度' });
    fireEvent.click(trigger);
    const search = screen.getByLabelText('搜索选项');
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
