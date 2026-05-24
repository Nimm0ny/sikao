import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListItem } from './ListItem';

describe('ListItem', () => {
  it('renders as <button> and triggers onPress when clicked', () => {
    const onPress = vi.fn();
    render(<ListItem title="设置" onPress={onPress} />);
    const btn = screen.getByRole('button', { name: '设置' });
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without onPress as a non-interactive listitem div', () => {
    render(<ListItem title="只读" />);
    expect(screen.getByRole('listitem')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('marks selected via data-selected and aria-pressed when interactive', () => {
    render(<ListItem title="当前页" onPress={() => {}} selected />);
    const btn = screen.getByRole('button', { name: '当前页' });
    expect(btn.dataset.selected).toBe('true');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders the drag-handle slot when draggable=true', () => {
    render(<ListItem title="可拖" draggable onPress={() => {}} />);
    expect(screen.getByTestId('listitem-drag-handle')).toBeInTheDocument();
  });

  it('does not call onPress when disabled is set', () => {
    const onPress = vi.fn();
    render(<ListItem title="禁用" onPress={onPress} disabled />);
    const btn = screen.getByRole('button', { name: '禁用' });
    fireEvent.click(btn);
    expect(onPress).not.toHaveBeenCalled();
    expect(btn).toBeDisabled();
  });
});
