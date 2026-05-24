import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

/*
 * ConfirmDialog tests — V5 D.3.22 overlay (skeleton).
 * Why: cover destructive→danger button, default cancelText, onConfirm
 *      sync trigger + loading lock, async Promise resolves to onClose.
 *      Delegates rendering to Modal, so we assert through Modal's exposed
 *      role="dialog" + button text.
 */

describe('ConfirmDialog', () => {
  it('destructive=true wires confirm button to data-variant="danger"', () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="确认删除"
        description="此操作不可撤销"
        confirmText="删除"
        destructive
        onConfirm={() => {}}
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: '删除' });
    expect(confirmBtn).toHaveAttribute('data-variant', 'danger');
  });

  it('cancelText defaults to "取消"', () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="t"
        description="d"
        confirmText="ok"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
  });

  it('external loading prop disables confirm trigger and clicks are no-ops', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="t"
        description="d"
        confirmText="确定"
        loading
        onConfirm={onConfirm}
      />,
    );
    // While loading the rendered confirm label is "处理中…".
    const btn = screen.getByRole('button', { name: '处理中…' });
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('async onConfirm sets loading then onClose after the Promise resolves', async () => {
    let resolveFn: (() => void) | null = null;
    const onConfirm = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveFn = resolve;
      }),
    );
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="t"
        description="d"
        confirmText="确定"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Internal loading flips → button label switches to 处理中….
    await screen.findByRole('button', { name: '处理中…' });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      resolveFn?.();
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
