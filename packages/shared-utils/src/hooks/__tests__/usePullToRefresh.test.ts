import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import { usePullToRefresh } from '../usePullToRefresh';

/**
 * usePullToRefresh (PR12 §8.4):
 *   - 下拉 ≥ 64px + 释放 → 触发 onRefresh
 *   - 下拉 < 64px + 释放 → 无 onRefresh
 *   - refreshing 期间 (onRefresh pending) 不重复触发
 *
 * window.scrollY 必须 mock 成 0 (jsdom 默认 0, 但显式写防被其他 test 污染).
 */
function makePointerAt(clientY: number): React.PointerEvent {
  return { clientY } as unknown as React.PointerEvent;
}

describe('usePullToRefresh', () => {
  let originalScrollY: number;

  beforeEach(() => {
    originalScrollY = window.scrollY;
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'scrollY', {
      value: originalScrollY,
      writable: true,
      configurable: true,
    });
  });

  it('triggers onRefresh when pull distance ≥ 64 and release', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));
    act(() => result.current.handlers.onPointerDown(makePointerAt(0)));
    act(() => result.current.handlers.onPointerMove(makePointerAt(80)));
    expect(result.current.pullDistance).toBe(80);
    await act(async () => {
      await result.current.handlers.onPointerUp();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.pullDistance).toBe(0);
  });

  it('does not trigger onRefresh when pull distance < 64', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));
    act(() => result.current.handlers.onPointerDown(makePointerAt(0)));
    act(() => result.current.handlers.onPointerMove(makePointerAt(40)));
    expect(result.current.pullDistance).toBe(40);
    await act(async () => {
      await result.current.handlers.onPointerUp();
    });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.pullDistance).toBe(0);
  });

  it('does not re-trigger onRefresh while previous refresh is pending', async () => {
    let resolveRefresh: (() => void) | undefined;
    const onRefresh = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    // 第一次下拉 + 释放, 不 await — onRefresh 卡在 pending
    act(() => result.current.handlers.onPointerDown(makePointerAt(0)));
    act(() => result.current.handlers.onPointerMove(makePointerAt(80)));
    let firstRelease: Promise<void> | undefined;
    act(() => {
      firstRelease = result.current.handlers.onPointerUp();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(true);

    // refreshing 期间第二次下拉 + 释放 — 不应再触发
    act(() => result.current.handlers.onPointerDown(makePointerAt(0)));
    act(() => result.current.handlers.onPointerMove(makePointerAt(80)));
    await act(async () => {
      await result.current.handlers.onPointerUp();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // 收尾: 让第一个 promise resolve, refreshing 回 false
    await act(async () => {
      resolveRefresh?.();
      await firstRelease;
    });
    expect(result.current.refreshing).toBe(false);
  });
});
