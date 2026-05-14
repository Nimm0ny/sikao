import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultTabNav, type ResultTabItem } from '../ResultTabNav';

const TABS: ReadonlyArray<ResultTabItem> = [
  { id: 'overview', label: '总览' },
  { id: 'questions', label: '题目' },
  { id: 'timing', label: '用时' },
  { id: 'actions', label: '操作' },
];

describe('ResultTabNav', () => {
  it('renders all tabs with proper a11y semantics', () => {
    render(<ResultTabNav tabs={TABS} activeId="overview" />);
    // tablist + 4 tabs
    const nav = screen.getByTestId('result-tab-nav');
    expect(nav).toHaveAttribute('role', 'tablist');
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    // 每个 tab 有 testid + 中文 label
    expect(screen.getByTestId('result-tab-overview')).toHaveTextContent('总览');
    expect(screen.getByTestId('result-tab-questions')).toHaveTextContent('题目');
    expect(screen.getByTestId('result-tab-timing')).toHaveTextContent('用时');
    expect(screen.getByTestId('result-tab-actions')).toHaveTextContent('操作');
  });

  it('aria-selected reflects activeId', () => {
    const { rerender } = render(<ResultTabNav tabs={TABS} activeId="overview" />);
    expect(screen.getByTestId('result-tab-overview')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('result-tab-questions')).toHaveAttribute('aria-selected', 'false');

    rerender(<ResultTabNav tabs={TABS} activeId="timing" />);
    expect(screen.getByTestId('result-tab-overview')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('result-tab-timing')).toHaveAttribute('aria-selected', 'true');
  });

  it('active tab carries border-ink className for visual highlight', () => {
    render(<ResultTabNav tabs={TABS} activeId="questions" />);
    const active = screen.getByTestId('result-tab-questions');
    expect(active.className).toContain('border-ink');
    expect(active.className).toContain('font-medium');

    const inactive = screen.getByTestId('result-tab-overview');
    expect(inactive.className).toContain('border-transparent');
    expect(inactive.className).toContain('text-ink-3');
  });

  it('falls back to native anchor href when no onTabClick is provided', () => {
    render(<ResultTabNav tabs={TABS} activeId="overview" />);
    const tab = screen.getByTestId('result-tab-questions');
    expect(tab.getAttribute('href')).toBe('#questions');
    expect(tab.getAttribute('aria-controls')).toBe('section-questions');
  });

  it('invokes onTabClick and prevents default when handler is provided', async () => {
    const user = userEvent.setup();
    const onTabClick = vi.fn();
    render(<ResultTabNav tabs={TABS} activeId="overview" onTabClick={onTabClick} />);
    await user.click(screen.getByTestId('result-tab-timing'));
    expect(onTabClick).toHaveBeenCalledTimes(1);
    expect(onTabClick).toHaveBeenCalledWith('timing');
  });

  it('renders empty when tabs array is empty (defensive)', () => {
    render(<ResultTabNav tabs={[]} activeId="" />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByTestId('result-tab-nav')).toBeInTheDocument();
  });
});
