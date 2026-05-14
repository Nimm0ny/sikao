import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import { useSwipeAction } from '../useSwipeAction';

/**
 * useSwipeAction (PR12 §8.3):
 *   - swipe right > +80px → onSwipeRight
 *   - swipe left < -80px → onSwipeLeft
 *   - 阈值内 → 无回调
 *   - offset state 同步 (PointerMove 期间)
 */
function makePointerAt(clientX: number): React.PointerEvent {
  return { clientX } as unknown as React.PointerEvent;
}

describe('useSwipeAction', () => {
  it('fires onSwipeRight when offset > +threshold', () => {
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipeAction({ onSwipeLeft, onSwipeRight }));
    act(() => result.current.onPointerDown(makePointerAt(0)));
    act(() => result.current.onPointerMove(makePointerAt(120)));
    act(() => result.current.onPointerUp());
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('fires onSwipeLeft when offset < -threshold', () => {
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipeAction({ onSwipeLeft, onSwipeRight }));
    act(() => result.current.onPointerDown(makePointerAt(200)));
    act(() => result.current.onPointerMove(makePointerAt(80)));
    act(() => result.current.onPointerUp());
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('does not fire when offset is within threshold (|offset| ≤ 80)', () => {
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipeAction({ onSwipeLeft, onSwipeRight }));
    act(() => result.current.onPointerDown(makePointerAt(0)));
    act(() => result.current.onPointerMove(makePointerAt(50)));
    act(() => result.current.onPointerUp());
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('exposes offset state synced with PointerMove', () => {
    const { result } = renderHook(() => useSwipeAction({}));
    expect(result.current.offset).toBe(0);
    act(() => result.current.onPointerDown(makePointerAt(100)));
    act(() => result.current.onPointerMove(makePointerAt(160)));
    expect(result.current.offset).toBe(60);
    act(() => result.current.onPointerUp());
    // 释放后 reset 回 0
    expect(result.current.offset).toBe(0);
  });
});
