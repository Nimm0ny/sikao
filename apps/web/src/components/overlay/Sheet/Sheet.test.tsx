import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from './Sheet';

/*
 * Sheet tests — V5 D.3.5 overlay (skeleton).
 * Why: cover open/closed render, Esc close, draggable threshold dismissal,
 *      and footer rendering. Drag uses pointer events; jsdom delivers them
 *      via fireEvent.pointer*.
 */

describe('Sheet', () => {
  it('renders nothing when open=false and a portal panel when open=true', () => {
    const { rerender } = render(
      <Sheet open={false} onClose={() => {}}>
        <p>body</p>
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(
      <Sheet open onClose={() => {}} title="标题">
        <p>body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-handle')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-overlay').parentElement).toBe(document.body);
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="t">
        <p>x</p>
      </Sheet>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('drag past threshold triggers onClose; short drag snaps back', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet open onClose={onClose} title="t" draggable>
        <p>body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog');
    const handleArea = screen.getByTestId('sheet-handle-area');
    // Force a measurable height so threshold math is deterministic.
    Object.defineProperty(dialog, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 0, left: 0, right: 100, bottom: 200, width: 100, height: 200, x: 0, y: 0, toJSON: () => ({}) }),
    });

    // Short drag (40px / 200px = 20%) → no close
    fireEvent.pointerDown(handleArea, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handleArea, { clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(handleArea, { clientY: 40, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();

    // Long drag (120px / 200px = 60%) → close
    rerender(
      <Sheet open onClose={onClose} title="t" draggable>
        <p>body</p>
      </Sheet>,
    );
    const dialog2 = screen.getByRole('dialog');
    const handleArea2 = screen.getByTestId('sheet-handle-area');
    Object.defineProperty(dialog2, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 0, left: 0, right: 100, bottom: 200, width: 100, height: 200, x: 0, y: 0, toJSON: () => ({}) }),
    });
    fireEvent.pointerDown(handleArea2, { clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(handleArea2, { clientY: 120, pointerId: 2 });
    fireEvent.pointerUp(handleArea2, { clientY: 120, pointerId: 2 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders footer slot when footer prop is provided', () => {
    render(
      <Sheet open onClose={() => {}} title="t" footer={<button type="button">提交</button>}>
        <p>body</p>
      </Sheet>,
    );
    expect(screen.getByRole('button', { name: '提交' })).toBeInTheDocument();
  });
});
