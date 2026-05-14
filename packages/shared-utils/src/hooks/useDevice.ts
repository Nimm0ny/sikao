import { useSyncExternalStore } from 'react';

/**
 * Device 切片 (PR6, 2026-05-13) — 与 Mobile and Tablet Pack New §vii
 * + Handoff §2 SSOT 一致.
 *
 * Cutoff (跟 breakpoints.css 契约对齐, 不引入 4th 类):
 *   - mobile:  width < 1024
 *   - tablet:  1024 ≤ width < 1280
 *   - desktop: width ≥ 1280
 *
 * SSR fallback = 'desktop' (服务端默认走桌面退路, 客户端首次 effect 后
 * 真实切; 首屏可能闪一下, 跟 plan §6 风险条对齐).
 *
 * 横竖屏走 useOrientation() 单独判断, useDevice 不区分.
 */
export type Device = 'mobile' | 'tablet' | 'desktop';

function readDevice(): Device {
  // SSR fallback: 无 window 默认 desktop.
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w >= 1280) return 'desktop';
  if (w >= 1024) return 'tablet';
  return 'mobile';
}

function subscribeResize(cb: () => void): () => void {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}

export function useDevice(): Device {
  // getServerSnapshot 必须稳定返回相同值; SSR 阶段统一回 'desktop'.
  return useSyncExternalStore(subscribeResize, readDevice, () => 'desktop');
}
