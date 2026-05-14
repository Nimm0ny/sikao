import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEssaySessionElapsed } from '../useEssaySessionElapsed';

// useEssaySessionElapsed tests (PR13 P5, 2026-05-13).
//
// fake timers + vi.setSystemTime 让 Date.now 跟 timer 同步, 测试 setInterval
// 1s tick + Math.floor(delta/1000) 公式.

describe('useEssaySessionElapsed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mount 时 elapsed = 0', () => {
    const { result } = renderHook(() => useEssaySessionElapsed());
    expect(result.current).toBe(0);
  });

  it('1s 后 elapsed = 1', () => {
    const { result } = renderHook(() => useEssaySessionElapsed());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1);
  });

  it('60s 后 elapsed = 60', () => {
    const { result } = renderHook(() => useEssaySessionElapsed());
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(60);
  });

  it('unmount cleanup clearInterval (no leak)', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() => useEssaySessionElapsed());
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('小数 ms 被 Math.floor 截断 (1500ms → 1s)', () => {
    const { result } = renderHook(() => useEssaySessionElapsed());
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // 1.5s 时 setInterval 1s 已 fire 一次, Math.floor(1500/1000) = 1.
    expect(result.current).toBe(1);
  });
});
