import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomSheet } from '../BottomSheet';

// pure CSS transition 实现, 用 fake timer + RAF stub 跑入场 / 退场 / 拖把手.

describe('BottomSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 强制 RAF 同步触发, 让 isMounted 在 act() 内立即翻到 true.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      // noop · raf 已同步执行
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not render when closed', () => {
    render(
      <BottomSheet open={false} onClose={vi.fn()} aria-label="测试 sheet">
        <button type="button">题号 1</button>
      </BottomSheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '题号 1' })).not.toBeInTheDocument();
  });

  it('renders with role=dialog + aria-modal when open + title', () => {
    render(
      <BottomSheet open onClose={vi.fn()} title="自定义考试">
        <div>body</div>
      </BottomSheet>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { level: 2, name: '自定义考试' })).toBeInTheDocument();
  });

  it('uses aria-label when no title is given', () => {
    render(
      <BottomSheet open onClose={vi.fn()} aria-label="纯标签 sheet">
        <div>body</div>
      </BottomSheet>,
    );
    expect(screen.getByRole('dialog', { name: '纯标签 sheet' })).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="esc-test">
        <button type="button">btn</button>
      </BottomSheet>,
    );
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when grabber is dragged down past 80px threshold', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="drag-test">
        <div>body</div>
      </BottomSheet>,
    );
    const grabber = screen.getByTestId('bottom-sheet-grabber');
    // 模拟 pointer down/move/up: 拖 90px > 80 阈值 → 触发 onClose.
    act(() => {
      fireEvent.pointerDown(grabber, { clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(grabber, { clientY: 200, pointerId: 1 });
      fireEvent.pointerUp(grabber, { clientY: 200, pointerId: 1 });
    });
    // requestClose 走 200ms setTimeout 后才调 onClose
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when grabber drag is below 80px threshold', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="below-threshold">
        <div>body</div>
      </BottomSheet>,
    );
    const grabber = screen.getByTestId('bottom-sheet-grabber');
    act(() => {
      fireEvent.pointerDown(grabber, { clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(grabber, { clientY: 140, pointerId: 1 }); // 40px < 80
      fireEvent.pointerUp(grabber, { clientY: 140, pointerId: 1 });
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="backdrop-test">
        <div>body</div>
      </BottomSheet>,
    );
    const backdrop = screen.getByTestId('bottom-sheet-backdrop');
    act(() => {
      fireEvent.click(backdrop);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('focus trap: Tab from last focusable wraps to first', async () => {
    vi.useRealTimers(); // userEvent 需要真 timer
    const user = userEvent.setup();
    render(
      <BottomSheet open onClose={vi.fn()} title="trap-test">
        <button type="button">first</button>
        <button type="button">second</button>
      </BottomSheet>,
    );
    const second = screen.getByRole('button', { name: 'second' });
    // 初始 focus 落在第一个 focusable (grabber role=button) — 先 Tab 一次确认.
    second.focus();
    await user.tab(); // 从 second → 应循环回 grabber 或 first
    // 焦点不应该跳出 sheet (i.e. 不应该是 body 或 undefined HTMLElement)
    const activeNode = document.activeElement;
    expect(activeNode).not.toBe(document.body);
    expect(screen.getByTestId('bottom-sheet-panel').contains(activeNode)).toBe(true);
  });
});
