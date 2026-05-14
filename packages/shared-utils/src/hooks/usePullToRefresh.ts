import { useRef, useState } from 'react';
import type React from 'react';

/**
 * Pull-to-refresh gesture (PR12, 2026-05-13) — Handoff §8.4 (Mobile and Tablet).
 *
 * 下拉触发阈值默认 64px, 仅在 window.scrollY === 0 时启动 (顶部 guard).
 * onRefresh 可异步, refreshing 期间不重复触发.
 *
 * 通用 hook — device 判断由调用方负责. indicator 形态 (ASCII `— · —` /
 * 自绘 SVG) 由调用方渲染, hook 仅暴露 pullDistance / refreshing / angle
 * 三个状态.
 *
 * 用法:
 *   const { handlers, pullDistance, refreshing, angle } = usePullToRefresh({
 *     onRefresh: () => queryClient.invalidateQueries(...),
 *   });
 *   <div {...handlers}>
 *     <div style={{ transform: `rotate(${angle}deg)`, opacity: pullDistance / 64 }}>
 *       — · —
 *     </div>
 *   </div>
 */
interface UsePullToRefreshOptions {
  /** 触发阈值 (px), 默认 64 */
  threshold?: number;
  onRefresh: () => void | Promise<void>;
}

interface UsePullToRefreshHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => Promise<void>;
  onPointerCancel: () => void;
}

interface UsePullToRefreshResult {
  handlers: UsePullToRefreshHandlers;
  /** 当前下拉距离 (px) */
  pullDistance: number;
  /** 是否正在刷新 */
  refreshing: boolean;
  /** indicator 旋转角度 (用于 transform: rotate()) — 当前等于 pullDistance */
  angle: number;
}

export function usePullToRefresh({
  threshold = 64,
  onRefresh,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const startY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const reset = (): void => {
    setPullDistance(0);
    startY.current = null;
  };

  return {
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        // 仅在顶部触发, 避免与滚动手势冲突.
        if (window.scrollY > 0) return;
        startY.current = e.clientY;
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (startY.current === null) return;
        const d = e.clientY - startY.current;
        if (d > 0) setPullDistance(d);
      },
      onPointerUp: async () => {
        if (pullDistance >= threshold && !refreshing) {
          setRefreshing(true);
          try {
            await onRefresh();
          } finally {
            setRefreshing(false);
            reset();
          }
        } else {
          reset();
        }
      },
      onPointerCancel: reset,
    },
    pullDistance,
    refreshing,
    angle: pullDistance,
  };
}
