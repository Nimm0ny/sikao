import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FbSettingsPopover } from '../FbSettingsPopover';

describe('FbSettingsPopover', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-density');
    document.documentElement.removeAttribute('data-opt-style');
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-density');
    document.documentElement.removeAttribute('data-opt-style');
    vi.restoreAllMocks();
  });

  it('default cozy radio is selected', () => {
    render(<FbSettingsPopover open onClose={() => undefined} />);
    const cozy = screen.getByRole('radio', { name: '舒适' });
    const compact = screen.getByRole('radio', { name: '紧凑' });
    expect(cozy).toHaveAttribute('aria-checked', 'true');
    expect(compact).toHaveAttribute('aria-checked', 'false');
  });

  it('default circle radio is selected (opt style)', () => {
    render(<FbSettingsPopover open onClose={() => undefined} />);
    const circle = screen.getByRole('radio', { name: '圆形' });
    const square = screen.getByRole('radio', { name: '方形' });
    expect(circle).toHaveAttribute('aria-checked', 'true');
    expect(square).toHaveAttribute('aria-checked', 'false');
  });

  it('switching to compact updates aria-checked + html dataset.density + localStorage', () => {
    render(<FbSettingsPopover open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('radio', { name: '紧凑' }));
    expect(screen.getByRole('radio', { name: '紧凑' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '舒适' })).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(window.localStorage.getItem('fb-settings-v1')).toContain('"density":"compact"');
  });

  it('switching to square updates aria-checked + html dataset.optStyle + localStorage', () => {
    render(<FbSettingsPopover open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('radio', { name: '方形' }));
    expect(screen.getByRole('radio', { name: '方形' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '圆形' })).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement.dataset.optStyle).toBe('square');
    expect(window.localStorage.getItem('fb-settings-v1')).toContain('"optStyle":"square"');
  });

  it('outside pointerdown calls onClose', () => {
    const onClose = vi.fn();
    render(
      <div>
        <button type="button" data-testid="outside">
          outside
        </button>
        <FbSettingsPopover open onClose={onClose} />
      </div>,
    );
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key calls onClose', () => {
    const onClose = vi.fn();
    render(<FbSettingsPopover open onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keyboard arrow right moves density selection cozy → compact', () => {
    render(<FbSettingsPopover open onClose={() => undefined} />);
    const cozy = screen.getByRole('radio', { name: '舒适' });
    cozy.focus();
    fireEvent.keyDown(cozy, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: '紧凑' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.density).toBe('compact');
  });

  it('keyboard arrow left moves density selection compact → cozy', () => {
    window.localStorage.setItem('fb-settings-v1', JSON.stringify({ density: 'compact' }));
    render(<FbSettingsPopover open onClose={() => undefined} />);
    const compact = screen.getByRole('radio', { name: '紧凑' });
    compact.focus();
    fireEvent.keyDown(compact, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: '舒适' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.density).toBe('cozy');
  });

  it('keyboard arrow right moves opt-style selection circle → square', () => {
    render(<FbSettingsPopover open onClose={() => undefined} />);
    const circle = screen.getByRole('radio', { name: '圆形' });
    circle.focus();
    fireEvent.keyDown(circle, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: '方形' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.optStyle).toBe('square');
  });

  it('panel has role=dialog + aria-label="阅读设置" + id for aria-controls', () => {
    render(<FbSettingsPopover open onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: '阅读设置' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('id', 'fb-settings-popover');
  });

  it('open=false hides panel entirely', () => {
    render(<FbSettingsPopover open={false} onClose={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
