import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Search } from './Search';

function Harness({
  initialValue = '',
  suggestions,
  onChangeSpy,
  onSubmitSpy,
  clearable,
}: {
  initialValue?: string;
  suggestions?: string[];
  onChangeSpy?: (v: string) => void;
  onSubmitSpy?: (v: string) => void;
  clearable?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <Search
      value={value}
      onChange={(v) => {
        setValue(v);
        onChangeSpy?.(v);
      }}
      onSubmit={onSubmitSpy}
      suggestions={suggestions}
      clearable={clearable}
      aria-label="搜索"
    />
  );
}

describe('Search', () => {
  it('mounts as a search landmark with value/onChange wiring', () => {
    const onChange = vi.fn();
    render(<Harness onChangeSpy={onChange} />);
    const search = screen.getByRole('search');
    expect(search).toBeInTheDocument();
    const input = screen.getByLabelText('搜索');
    fireEvent.change(input, { target: { value: 'shenlun' } });
    expect(onChange).toHaveBeenCalledWith('shenlun');
  });

  it('triggers onSubmit when Enter is pressed inside the form', () => {
    const onSubmit = vi.fn();
    render(<Harness initialValue="abc" onSubmitSpy={onSubmit} />);
    const form = screen.getByRole('search') as HTMLFormElement;
    // Native Enter inside a single-input form submits — emulate via fireEvent.
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledWith('abc');
  });

  it('renders the clear button only when clearable && value.length > 0', () => {
    const { rerender } = render(
      <Search value="" onChange={() => {}} aria-label="搜索" />,
    );
    expect(screen.queryByRole('button', { name: '清空' })).toBeNull();
    rerender(<Search value="abc" onChange={() => {}} aria-label="搜索" />);
    expect(screen.getByRole('button', { name: '清空' })).toBeInTheDocument();
  });

  it('clear button empties the value', () => {
    const onChange = vi.fn();
    render(<Search value="abc" onChange={onChange} aria-label="搜索" />);
    fireEvent.click(screen.getByRole('button', { name: '清空' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('opens a suggestions popover when suggestions[] is non-empty', () => {
    render(<Harness suggestions={['行测', '申论', '面试']} initialValue="" />);
    // Trigger is the inputWrap span in Popover; click toggles open.
    const input = screen.getByLabelText('搜索');
    // Popover trigger lives on the wrapping span; click bubbles.
    fireEvent.click(input.parentElement!.parentElement!);
    expect(screen.getByText('行测')).toBeInTheDocument();
    expect(screen.getByText('申论')).toBeInTheDocument();
    expect(screen.getByText('面试')).toBeInTheDocument();
  });
});
