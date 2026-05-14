import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbOpts } from '../FbOpts';

describe('FbOpts', () => {
  const options = [
    { key: 'A', text: '选项 A 正文' },
    { key: 'B', text: '选项 B 正文' },
    { key: 'C', text: '选项 C 正文' },
    { key: 'D', text: '选项 D 正文' },
  ];

  // ─── single_choice 分支 ─────────────────────────────────────

  it('renders 4 options as radiogroup (single default)', () => {
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByTestId('fb-opts-q1')).toHaveAttribute('data-qtype', 'single');
  });

  it('renders selected option with data-state="selected"', () => {
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={['B']}
        onChange={vi.fn()}
      />,
    );
    const optB = screen.getByTestId('fb-opt-B');
    expect(optB).toHaveAttribute('aria-checked', 'true');
    expect(optB).toHaveAttribute('data-state', 'selected');
    const optA = screen.getByTestId('fb-opt-A');
    expect(optA).toHaveAttribute('aria-checked', 'false');
    expect(optA).toHaveAttribute('data-state', 'unanswered');
  });

  it('clicking an option fires onChange with [key] (single)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={[]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId('fb-opt-C'));
    expect(onChange).toHaveBeenCalledWith('q1', ['C']);
  });

  it('disabled prop blocks all clicks', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={[]}
        disabled
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId('fb-opt-A'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('aria-label includes option key + text for screen readers', () => {
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('选项 A: 选项 A 正文')).toBeInTheDocument();
  });

  // ─── multiple_choice 分支 ────────────────────────────────────

  it('multi: renders 4 options as role=group with role=checkbox', () => {
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={[]}
        questionKind="multiple_choice"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByTestId('fb-opts-q1')).toHaveAttribute('data-qtype', 'multi');
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('multi: clicking an option fires onChange with sorted array (toggle on)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={['B']}
        questionKind="multiple_choice"
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId('fb-opt-A'));
    // 排序后 ['A', 'B'] (按 options display order).
    expect(onChange).toHaveBeenCalledWith('q1', ['A', 'B']);
  });

  it('multi: clicking a selected option toggles off', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={['A', 'B']}
        questionKind="multiple_choice"
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId('fb-opt-A'));
    expect(onChange).toHaveBeenCalledWith('q1', ['B']);
  });

  it('multi: selected.length === 1 shows at-least-2 hint', () => {
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={['A']}
        questionKind="multiple_choice"
        onChange={vi.fn()}
      />,
    );
    const hint = screen.getByTestId('fb-opts-multi-hint');
    expect(hint).toHaveTextContent('多选题, 请至少选 2 项');
    expect(hint).toHaveAttribute('role', 'status');
    expect(hint).toHaveAttribute('aria-live', 'polite');
  });

  it('multi: selected.length !== 1 hides the hint', () => {
    const { rerender } = render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={[]}
        questionKind="multiple_choice"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('fb-opts-multi-hint')).toBeNull();
    rerender(
      <FbOpts
        questionId="q1"
        options={options}
        selected={['A', 'B']}
        questionKind="multiple_choice"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('fb-opts-multi-hint')).toBeNull();
  });

  it('multi: selected option renders SVG check (not the letter)', () => {
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={['B']}
        questionKind="multiple_choice"
        onChange={vi.fn()}
      />,
    );
    const optB = screen.getByTestId('fb-opt-B');
    expect(optB.querySelector('svg')).not.toBeNull();
    // Selected multi letter span should NOT show the raw letter character.
    const letter = optB.querySelector('[data-letter]');
    expect(letter?.textContent ?? '').not.toContain('B');
  });

  it('single: unselected option renders raw letter (no svg in letter span)', () => {
    render(
      <FbOpts
        questionId="q1"
        options={options}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    const optA = screen.getByTestId('fb-opt-A');
    const letter = optA.querySelector('[data-letter]');
    expect(letter?.textContent).toBe('A');
    expect(letter?.querySelector('svg')).toBeNull();
  });
});
