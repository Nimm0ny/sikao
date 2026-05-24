import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chip } from './Chip';

describe('Chip — static mode (pass-through to Tag)', () => {
  it('shares Tag rendering — variant data attr propagates', () => {
    render(<Chip variant="info">已选</Chip>);
    const el = screen.getByText('已选').closest('[data-variant]') as HTMLElement;
    expect(el.dataset.variant).toBe('info');
  });

  it('fires onRemove when × is clicked', () => {
    const onRemove = vi.fn();
    render(
      <Chip variant="brand" onRemove={onRemove}>
        筛选
      </Chip>,
    );
    fireEvent.click(screen.getByTestId('tag-remove'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders without a remove button by default', () => {
    render(<Chip variant="ok">通过</Chip>);
    expect(screen.queryByTestId('tag-remove')).toBeNull();
  });
});

describe('Chip — selectable mode (active + onSelect)', () => {
  it('renders as <button> with aria-pressed when onSelect is provided', () => {
    render(
      <Chip onSelect={() => {}} active={false}>
        全部
      </Chip>,
    );
    const btn = screen.getByRole('button', { name: '全部' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('flips aria-pressed + data-active when active=true', () => {
    render(
      <Chip onSelect={() => {}} active>
        已选
      </Chip>,
    );
    const btn = screen.getByRole('button', { name: '已选' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.dataset.active).toBe('true');
  });

  it('fires onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(
      <Chip onSelect={onSelect} active={false}>
        点我
      </Chip>,
    );
    fireEvent.click(screen.getByRole('button', { name: '点我' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not fire onSelect when disabled', () => {
    const onSelect = vi.fn();
    render(
      <Chip onSelect={onSelect} disabled>
        禁用
      </Chip>,
    );
    fireEvent.click(screen.getByRole('button', { name: '禁用' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('forwards data-variant for the brand-yellow active visual', () => {
    render(
      <Chip variant="brand" onSelect={() => {}} active>
        收藏
      </Chip>,
    );
    const btn = screen.getByRole('button', { name: '收藏' });
    expect(btn.dataset.variant).toBe('brand');
    expect(btn.dataset.active).toBe('true');
  });
});
