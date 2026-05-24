import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from './Tabs';
import type { TabItem } from './Tabs';

const items: TabItem[] = [
  { key: 'a', label: '今日' },
  { key: 'b', label: '本周' },
  { key: 'c', label: '历史' },
];

describe('Tabs', () => {
  it('exposes role="tablist" with role="tab" children and aria-selected synced', () => {
    render(<Tabs items={items} active="b" onChange={() => {}} />);
    const list = screen.getByRole('tablist');
    expect(list).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });

  it('fires onChange(key) when an inactive tab is clicked', () => {
    const onChange = vi.fn();
    render(<Tabs items={items} active="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: '历史' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('does not fire onChange when a disabled tab is clicked', () => {
    const onChange = vi.fn();
    const withDisabled: TabItem[] = [
      { key: 'a', label: '今日' },
      { key: 'b', label: '本周', disabled: true },
    ];
    render(<Tabs items={withDisabled} active="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: '本周' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the requested variant via data-variant on the tablist', () => {
    const { rerender } = render(<Tabs items={items} active="a" onChange={() => {}} variant="underline" />);
    expect(screen.getByRole('tablist').dataset.variant).toBe('underline');
    rerender(<Tabs items={items} active="a" onChange={() => {}} variant="pill" />);
    expect(screen.getByRole('tablist').dataset.variant).toBe('pill');
    rerender(<Tabs items={items} active="a" onChange={() => {}} variant="segmented" />);
    expect(screen.getByRole('tablist').dataset.variant).toBe('segmented');
  });
});
