import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../Modal';

// Modal device-aware: mobile (<1024) → BottomSheet 降级 / tablet+desktop → 居中卡片.
// 调用方 API 不变.

function setInnerWidth(value: number): void {
  act(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value });
    window.dispatchEvent(new Event('resize'));
  });
}

describe('Modal (device-aware)', () => {
  let originalWidth: number;

  beforeEach(() => {
    originalWidth = window.innerWidth;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    setInnerWidth(originalWidth);
    vi.restoreAllMocks();
  });

  it('renders BottomSheet on mobile viewport (open=true)', () => {
    setInnerWidth(390); // mobile
    render(
      <Modal open onClose={vi.fn()} title="mobile modal" ariaLabel="mobile modal a11y">
        <p>body content</p>
      </Modal>,
    );
    // mobile → BottomSheet → 有 bottom-sheet-panel testid.
    expect(screen.getByTestId('bottom-sheet-panel')).toBeInTheDocument();
  });

  it('renders centered card on desktop viewport with aria-modal', () => {
    setInnerWidth(1440); // desktop
    render(
      <Modal open onClose={vi.fn()} title="desktop modal" ariaLabel="desktop modal a11y">
        <p>body content</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'desktop modal a11y' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // 不应该有 BottomSheet 渲染
    expect(screen.queryByTestId('bottom-sheet-panel')).not.toBeInTheDocument();
  });

  it('renders centered card on tablet viewport (no mobile fallback)', () => {
    setInnerWidth(1024); // tablet
    render(
      <Modal open onClose={vi.fn()} title="tablet modal" ariaLabel="tablet modal">
        <p>body content</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'tablet modal' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(screen.queryByTestId('bottom-sheet-panel')).not.toBeInTheDocument();
  });

  it('does not render when closed (desktop)', () => {
    setInnerWidth(1440);
    render(
      <Modal open={false} onClose={vi.fn()} title="closed" ariaLabel="closed">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose on Escape key (desktop)', () => {
    setInnerWidth(1440);
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="esc" ariaLabel="esc">
        <p>body</p>
      </Modal>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
