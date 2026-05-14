import { useCallback, useRef } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';

// Wave 9 Phase 2a (2026-05-12): mobile swipe 左右翻题.
//
// 设计 SSOT: docs/design/mobile-style-guide.md §5.6 swipe — "PracticeSession
// 题干区左右 swipe → 上 / 下 一题". 触发阈值: |dx| 超过 30% 屏宽 或速度
// > 0.3 px/ms 任一即生效; 横向 dominant (|dx| > |dy| * 1.4) 防垂直滚动误触.
//
// mobile-only: matchMedia '(max-width: 768px)' gate — tablet+ no-op (sticky
// FbBottomDock 已含 prev/next 入口, 双 affordance 不必要).
//
// Dumb by contract: hook 不读 store / 路由. onPrev / onNext 由 caller.

const SWIPE_DY_VS_DX_BLOCK_RATIO = 0.7; // |dy| > |dx| * 0.7 视为垂直滚动, 跳过
const SWIPE_THRESHOLD_RATIO = 0.3; // 屏宽 30%
const SWIPE_THRESHOLD_MAX_PX = 120; // 大屏 mobile (e.g. iPad Mini 768) 上限
const SWIPE_VELOCITY_PX_MS = 0.3;
const MOBILE_MQ = '(max-width: 768px)';

export interface UseFbMobileSwipeArgs {
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

export interface FbMobileSwipeHandlers {
  readonly onTouchStart: (e: ReactTouchEvent<HTMLDivElement>) => void;
  readonly onTouchEnd: (e: ReactTouchEvent<HTMLDivElement>) => void;
}

interface SwipeStart {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export function useFbMobileSwipe({
  onPrev,
  onNext,
}: UseFbMobileSwipeArgs): FbMobileSwipeHandlers {
  const startRef = useRef<SwipeStart | null>(null);

  const onTouchStart = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia(MOBILE_MQ).matches) return;
    const t = e.touches[0];
    if (t === undefined) return;
    startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      const start = startRef.current;
      startRef.current = null;
      if (start === null) return;
      const t = e.changedTouches[0];
      if (t === undefined) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Math.max(1, Date.now() - start.t);
      // 垂直滚动 dominant → 不响应 (避免上下滑误触翻题).
      if (Math.abs(dy) > Math.abs(dx) * SWIPE_DY_VS_DX_BLOCK_RATIO) return;
      const threshold = Math.min(
        window.innerWidth * SWIPE_THRESHOLD_RATIO,
        SWIPE_THRESHOLD_MAX_PX,
      );
      const velocity = Math.abs(dx) / dt;
      if (Math.abs(dx) < threshold && velocity < SWIPE_VELOCITY_PX_MS) return;
      // 向左 swipe (dx < 0) = 下一题; 向右 swipe (dx > 0) = 上一题 (公考用户习惯).
      if (dx < 0) onNext();
      else onPrev();
    },
    [onPrev, onNext],
  );

  return { onTouchStart, onTouchEnd };
}
