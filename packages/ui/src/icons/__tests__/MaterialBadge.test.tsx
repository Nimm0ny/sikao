import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaterialBadge } from '../composite/MaterialBadge';

describe('MaterialBadge', () => {
  it('renders SVG-only pending button with status and aria-label', () => {
    render(
      <MaterialBadge index={1} status="pending" ariaLabel="材料 1, 未读" />,
    );
    const btn = screen.getByRole('button', { name: '材料 1, 未读' });
    expect(btn).toHaveAttribute('data-status', 'pending');
    expect(btn).toHaveAccessibleName('材料 1, 未读');
    expect(btn.textContent).toBe('');
    expect(btn.querySelector('svg')).not.toBeNull();
  });

  it('read status keeps status visual without button text', () => {
    render(<MaterialBadge index={2} status="read" ariaLabel="材料 2, 已读" />);
    const btn = screen.getByRole('button', { name: '材料 2, 已读' });
    expect(btn).toHaveAttribute('data-status', 'read');
    expect(btn.textContent).toBe('');
  });

  it('marked + count keeps count in aria-label only and renders dot SVG', () => {
    render(
      <MaterialBadge
        index={3}
        status="marked"
        count={2}
        ariaLabel="材料 3, 已读, 2 处"
      />,
    );
    const btn = screen.getByRole('button', { name: '材料 3, 已读, 2 处' });
    expect(btn.textContent).toBe('');
    const dot = btn.querySelector('circle[fill="var(--accent-1)"]');
    expect(dot?.getAttribute('fill')).toBe('var(--accent-1)');
  });

  it('marked WITHOUT count still renders no button text', () => {
    render(
      <MaterialBadge index={4} status="marked" ariaLabel="材料 4, 已读" />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('');
  });

  it('active status sets data-status, no dot', () => {
    render(
      <MaterialBadge index={5} status="active" ariaLabel="材料 5, 当前阅读" />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-status', 'active');
    expect(btn.textContent).toBe('');
    expect(btn.querySelector('circle[fill="var(--accent-1)"]')).toBeNull();
  });

  it('onClick fires when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <MaterialBadge
        index={1}
        status="pending"
        ariaLabel="材料 1, 未读"
        onClick={onClick}
      />,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
