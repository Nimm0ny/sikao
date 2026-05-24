import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Drawer } from './Drawer';

/*
 * Drawer tests — V5 D.3.21 overlay (skeleton).
 * Why: cover side variants render, size px width, footer rendering, Esc /
 *      close button work paths. Drawer mounts via createPortal so queries
 *      run against document.body.
 */

describe('Drawer', () => {
  it('renders each side variant with the expected data-side attr', () => {
    const sides = ['left', 'right', 'top', 'bottom'] as const;
    for (const side of sides) {
      const { unmount } = render(
        <Drawer open onClose={() => {}} side={side} title={`drawer-${side}`}>
          <p>body</p>
        </Drawer>,
      );
      const overlay = screen.getByTestId('drawer-overlay');
      expect(overlay).toHaveAttribute('data-side', side);
      const panel = screen.getByTestId('drawer-panel');
      expect(panel).toHaveAttribute('data-side', side);
      unmount();
    }
  });

  it('size sm/md/lg/full maps to width (left/right) or height (top/bottom)', () => {
    const cases: Array<{ side: 'left' | 'right' | 'top' | 'bottom'; size: 'sm' | 'md' | 'lg' | 'full'; expectedKey: 'width' | 'height'; expected: string }> = [
      { side: 'right', size: 'sm', expectedKey: 'width', expected: '360px' },
      { side: 'left', size: 'md', expectedKey: 'width', expected: '480px' },
      { side: 'top', size: 'lg', expectedKey: 'height', expected: '640px' },
      { side: 'bottom', size: 'full', expectedKey: 'height', expected: '100%' },
    ];
    for (const c of cases) {
      const { unmount } = render(
        <Drawer open onClose={() => {}} side={c.side} size={c.size} title="t">
          <p>body</p>
        </Drawer>,
      );
      const panel = screen.getByTestId('drawer-panel');
      expect(panel.style[c.expectedKey]).toBe(c.expected);
      expect(panel).toHaveAttribute('data-size', c.size);
      unmount();
    }
  });

  it('renders footer when provided', () => {
    render(
      <Drawer open onClose={() => {}} title="t" footer={<button type="button">提交</button>}>
        <p>body</p>
      </Drawer>,
    );
    expect(screen.getByRole('button', { name: '提交' })).toBeInTheDocument();
  });

  it('calls onClose on Esc and on the close button', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="t">
        <p>body</p>
      </Drawer>,
    );
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
