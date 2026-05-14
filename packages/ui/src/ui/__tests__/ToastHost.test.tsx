import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastHost } from '../ToastHost';
import { toast, dismiss, subscribe } from '@sikao/shared-utils';

// lib/toast.ts queue 是模块级 state, 跨 test 持续. 每个 test 后清空所有 pending toast.
afterEach(() => {
  cleanup();
  // 拿当前 queue ids 全部 dismiss.
  let ids: number[] = [];
  const unsub = subscribe(items => {
    ids = items.map(t => t.id);
  });
  unsub();
  for (const id of ids) dismiss(id);
});

describe('ToastHost', () => {
  it('renders aria-live polite region with bottom-right position + z-toast', () => {
    render(<ToastHost />);
    const host = screen.getByTestId('toast-host');
    expect(host).toHaveAttribute('aria-live', 'polite');
    expect(host.className).toContain('fixed');
    expect(host.className).toContain('bottom-4');
    expect(host.className).toContain('right-4');
    expect(host.className).toContain('z-[80]');
  });

  it('renders toast items dispatched via lib/toast API (outer API unchanged)', () => {
    render(<ToastHost />);
    act(() => {
      toast.info('保存成功', '草稿已保存');
    });
    expect(screen.getByText('保存成功')).toBeInTheDocument();
    expect(screen.getByText(/草稿已保存/)).toBeInTheDocument();
  });

  it('toast.error maps to err tone (red dot)', () => {
    render(<ToastHost />);
    act(() => {
      toast.error('提交失败');
    });
    // queue 可能含历史 toast, 锁刚 dispatch 那一条的 status row.
    const failed = screen.getByText('提交失败').closest('[role="status"]');
    expect(failed).not.toBeNull();
    const dot = (failed as HTMLElement).querySelector(
      '[data-pattern="dot"]',
    ) as HTMLElement;
    expect(dot.className).toContain('bg-err');
  });
});
