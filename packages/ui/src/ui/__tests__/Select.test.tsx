import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from '../Select';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('Select', () => {
  it('renders selected option label + caret with aria-label', () => {
    render(
      <Select value="b" onChange={() => {}} options={OPTIONS} aria-label="选择字母" />,
    );
    // 原生 <option> 也含 "Beta" 文本; 查 display span 用 className 过滤.
    const display = screen.getAllByText('Beta').find(el => el.tagName === 'SPAN');
    expect(display).toBeInTheDocument();
    expect(screen.getByText('▾')).toBeInTheDocument();
    expect(screen.getByLabelText('选择字母')).toBeInTheDocument();
  });

  it('shows placeholder + ink-4 color when value is empty', () => {
    render(
      <Select
        value=""
        onChange={() => {}}
        options={OPTIONS}
        placeholder="请选择"
        aria-label="x"
      />,
    );
    // 占位文本既出现在 display span (class text-ink-4) 也出现在 <option hidden>;
    // 锁 SPAN 节点.
    const label = screen
      .getAllByText('请选择')
      .find(el => el.tagName === 'SPAN');
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass('text-ink-4');
  });

  it('onChange called when select value changes', () => {
    const onChange = vi.fn();
    render(
      <Select value="a" onChange={onChange} options={OPTIONS} aria-label="x" />,
    );
    fireEvent.change(screen.getByLabelText('x'), { target: { value: 'c' } });
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('disabled prop blocks interaction', () => {
    render(
      <Select value="a" onChange={() => {}} options={OPTIONS} disabled aria-label="x" />,
    );
    expect(screen.getByLabelText('x')).toBeDisabled();
  });

  it('size="sm" maps to smaller padding utility (sm vs md size class)', () => {
    const { container: smContainer } = render(
      <Select value="a" onChange={() => {}} options={OPTIONS} size="sm" aria-label="x" />,
    );
    const { container: mdContainer } = render(
      <Select value="a" onChange={() => {}} options={OPTIONS} size="md" aria-label="y" />,
    );
    const sm = smContainer.firstChild as HTMLElement;
    const md = mdContainer.firstChild as HTMLElement;
    expect(sm.className).toContain('text-meta');
    expect(md.className).toContain('text-small');
  });

  it('uses paper-1 bg + line-3 border + r-tiny radius (spec §5)', () => {
    const { container } = render(
      <Select value="a" onChange={() => {}} options={OPTIONS} aria-label="x" />,
    );
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toContain('bg-paper');
    expect(wrap.className).toContain('border-line-3');
    expect(wrap.className).toContain('rounded-tiny');
  });
});
