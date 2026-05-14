import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Drawer } from '../Drawer';

// Drawer 是 device-aware 包装 — 在不同 viewport 下渲染 BottomSheet 或 SideDrawer.
// jsdom default viewport = 1024 (tablet), 通过 Object.defineProperty + dispatch
// 'resize' 切档 (跟 useDevice 测试同模式).

function setInnerWidth(value: number): void {
  act(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value });
    window.dispatchEvent(new Event('resize'));
  });
}

describe('Drawer (device-aware)', () => {
  let originalWidth: number;

  beforeEach(() => {
    originalWidth = window.innerWidth;
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      // noop · raf 已同步执行
    });
  });

  afterEach(() => {
    setInnerWidth(originalWidth);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders BottomSheet on mobile viewport', () => {
    setInnerWidth(393); // iPhone 13
    render(
      <Drawer open onClose={vi.fn()} title="mobile drawer">
        <div>mobile body</div>
      </Drawer>,
    );
    // mobile → BottomSheet 自动降级, 用 BottomSheet 的 testid 校验.
    expect(screen.getByTestId('bottom-sheet-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-panel')).not.toBeInTheDocument();
  });

  it('renders side drawer on tablet viewport with width=420', () => {
    setInnerWidth(1024);
    render(
      <Drawer open onClose={vi.fn()} title="tablet drawer">
        <div>tablet body</div>
      </Drawer>,
    );
    const panel = screen.getByTestId('drawer-panel');
    expect(panel).toBeInTheDocument();
    // 默认 tablet width = 420
    expect(panel).toHaveStyle({ width: '420px' });
    expect(panel).toHaveAttribute('data-side', 'right');
  });

  it('renders side drawer on desktop viewport with width=480', () => {
    setInnerWidth(1440);
    render(
      <Drawer open onClose={vi.fn()} title="desktop drawer">
        <div>desktop body</div>
      </Drawer>,
    );
    const panel = screen.getByTestId('drawer-panel');
    expect(panel).toHaveStyle({ width: '480px' });
  });

  it('supports left side on desktop', () => {
    setInnerWidth(1440);
    render(
      <Drawer open onClose={vi.fn()} title="left drawer" side="left">
        <div>body</div>
      </Drawer>,
    );
    expect(screen.getByTestId('drawer-panel')).toHaveAttribute('data-side', 'left');
  });

  it('supports custom width override', () => {
    setInnerWidth(1440);
    render(
      <Drawer open onClose={vi.fn()} title="wide drawer" width={600}>
        <div>body</div>
      </Drawer>,
    );
    expect(screen.getByTestId('drawer-panel')).toHaveStyle({ width: '600px' });
  });

  it('calls onClose on backdrop click (desktop)', () => {
    setInnerWidth(1440);
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="close-test">
        <div>body</div>
      </Drawer>,
    );
    const backdrop = screen.getByTestId('drawer-backdrop');
    act(() => {
      fireEvent.click(backdrop);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key (desktop)', () => {
    setInnerWidth(1440);
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="esc-test">
        <button type="button">btn</button>
      </Drawer>,
    );
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render anything when open=false on desktop', () => {
    setInnerWidth(1440);
    render(
      <Drawer open={false} onClose={vi.fn()} title="closed drawer">
        <div>body</div>
      </Drawer>,
    );
    expect(screen.queryByTestId('drawer-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drawer-backdrop')).not.toBeInTheDocument();
  });
});
