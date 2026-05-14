import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOnline } from '../useOnline';

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

describe('useOnline', () => {
  beforeEach(() => {
    setNavigatorOnline(true);
  });

  it('initial value mirrors navigator.onLine=true', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
  });

  it('initial value mirrors navigator.onLine=false', () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  it('online → offline event flips state to false', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
  });

  it('offline → online event flips state to true', () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('removes both listeners on unmount (no leak)', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnline());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    removeSpy.mockRestore();
  });
});
