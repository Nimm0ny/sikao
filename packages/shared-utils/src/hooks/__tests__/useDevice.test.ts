import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDevice } from '../useDevice';

/**
 * vitest jsdom 默认 viewport = 1024×768 (tablet 档).
 * 通过 Object.defineProperty(window, 'innerWidth', { value: N }) 模拟 resize.
 * 必须 fireEvent('resize') (useSyncExternalStore 订阅 resize event).
 */
function setInnerWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value });
}

function fireResize(): void {
  window.dispatchEvent(new Event('resize'));
}

describe('useDevice', () => {
  let originalWidth: number;

  beforeEach(() => {
    originalWidth = window.innerWidth;
  });

  afterEach(() => {
    setInnerWidth(originalWidth);
  });

  it('returns "mobile" when innerWidth < 1024', () => {
    setInnerWidth(390); // iPhone 13
    const { result } = renderHook(() => useDevice());
    expect(result.current).toBe('mobile');
  });

  it('returns "tablet" when 1024 ≤ innerWidth < 1280', () => {
    setInnerWidth(1024); // iPad Mini 横屏
    const { result } = renderHook(() => useDevice());
    expect(result.current).toBe('tablet');
  });

  it('returns "desktop" when innerWidth ≥ 1280', () => {
    setInnerWidth(1440);
    const { result } = renderHook(() => useDevice());
    expect(result.current).toBe('desktop');
  });

  it('reacts to resize event (mobile → desktop)', () => {
    setInnerWidth(390);
    const { result } = renderHook(() => useDevice());
    expect(result.current).toBe('mobile');
    act(() => {
      setInnerWidth(1440);
      fireResize();
    });
    expect(result.current).toBe('desktop');
  });

  it('removes resize listener on unmount (no leak)', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useDevice());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});
