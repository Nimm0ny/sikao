import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import { useLongPress } from '../useLongPress';

/**
 * useLongPress (PR12 §8.2):
 *   - 350ms 后触发 callback
 *   - 350ms 前 onPointerUp / onPointerLeave 取消
 *
 * 用 vi.useFakeTimers 推时间, 避免真实等待 350ms.
 */
function makePointerEvent(): React.PointerEvent {
  // 仅 nativeEvent 字段被 hook 消费, 其余 React 包装字段可省略.
  return {
    nativeEvent: { type: 'pointerdown' } as unknown as PointerEvent,
  } as unknown as React.PointerEvent;
}

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires callback after 350ms (default threshold)', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    act(() => result.current.onPointerDown(makePointerEvent()));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('cancels timer if onPointerUp before threshold', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    act(() => result.current.onPointerDown(makePointerEvent()));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current.onPointerUp());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels timer on onPointerLeave', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    act(() => result.current.onPointerDown(makePointerEvent()));
    act(() => result.current.onPointerLeave());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
