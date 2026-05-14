import { useRef, useState } from 'react';
import type React from 'react';

/**
 * Swipe-action gesture (PR12, 2026-05-13) — Handoff §8.3 (Mobile and Tablet).
 *
 * 横向 swipe 阈值默认 80px, 触发 onSwipeLeft / onSwipeRight 回调.
 * offset state 用于 transform: translateX() 视觉同步 (调用方按需消费).
 *
 * 通用 hook — device 判断由调用方负责 (mobile WrongBook row swipe 揭示
 * 操作等使用场景).
 *
 * 用法:
 *   const { offset, ...handlers } = useSwipeAction({ onSwipeLeft: archive });
 *   <li {...handlers} style={{ transform: `translateX(${offset}px)` }}>...</li>
 */
interface UseSwipeActionOptions {
  /** swipe 触发阈值 (px), 默认 80 */
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface UseSwipeActionResult {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  /** 当前拖动偏移, 用于 transform: translateX() 视觉同步 */
  offset: number;
}

export function useSwipeAction({
  threshold = 80,
  onSwipeLeft,
  onSwipeRight,
}: UseSwipeActionOptions): UseSwipeActionResult {
  const startX = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      startX.current = e.clientX;
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (startX.current === null) return;
      setOffset(e.clientX - startX.current);
    },
    onPointerUp: () => {
      if (offset > threshold) onSwipeRight?.();
      if (offset < -threshold) onSwipeLeft?.();
      startX.current = null;
      setOffset(0);
    },
    onPointerCancel: () => {
      startX.current = null;
      setOffset(0);
    },
    offset,
  };
}
