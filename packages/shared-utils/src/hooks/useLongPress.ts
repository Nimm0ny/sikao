import { useRef } from 'react';
import type React from 'react';

/**
 * Long-press gesture (PR12, 2026-05-13) — Handoff §8.2 (Mobile and Tablet).
 *
 * 350ms 默认阈值. PointerDown 起计时, PointerUp/Leave/Cancel 任一即取消.
 * 通用 hook — device 判断由调用方负责 (mobile 答题 row 长按打开标注工具栏
 * 等使用场景).
 *
 * 用法:
 *   <p {...useLongPress(openAnnotateToolbar)}>...</p>
 */
interface UseLongPressOptions {
  /** ms · 默认 350 */
  delay?: number;
}

interface UseLongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

export function useLongPress(
  onLongPress: (e: PointerEvent) => void,
  options: UseLongPressOptions = {},
): UseLongPressHandlers {
  const { delay = 350 } = options;
  const timeoutRef = useRef<number | null>(null);

  const cancel = (): void => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      cancel();
      const nativeEvent = e.nativeEvent;
      timeoutRef.current = window.setTimeout(() => {
        onLongPress(nativeEvent);
      }, delay);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
}
