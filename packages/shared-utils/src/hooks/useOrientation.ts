import { useSyncExternalStore } from 'react';

/**
 * Orientation 切片 (PR6, 2026-05-13) — 与 useDevice 互补 (横竖屏单判).
 *
 * 用 matchMedia('(orientation: portrait)') 而非 width vs height 比较,
 * 避免 zoom < 100% / viewport meta 误差 (memory
 * reference_chrome_zoom_viewport_debug 教训, CSS viewport ≠ 物理屏).
 *
 * SSR fallback = 'landscape' (服务端默认走横屏退路, 客户端首次 effect
 * 后真实切).
 */
export type Orientation = 'portrait' | 'landscape';

function readOrientation(): Orientation {
  if (typeof window === 'undefined') return 'landscape';
  return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
}

function subscribeMedia(cb: () => void): () => void {
  const mql = window.matchMedia('(orientation: portrait)');
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

export function useOrientation(): Orientation {
  return useSyncExternalStore(subscribeMedia, readOrientation, () => 'landscape');
}
