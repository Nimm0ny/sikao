import { useEffect, useState } from 'react';

// Reactive `prefers-reduced-motion: reduce` hook. Reads the OS / browser-level
// preference and re-renders if the user toggles it mid-session.
//
// framer-motion 自带读取 (motion.ts §accessibility), 但原生 CSS transition
// / pointer-driven transform 没有. 卡片 swipe / tab indicator 等手写动画必须
// 通过此 hook 显式遵守.

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mql = window.matchMedia(QUERY);
    const handler = (event: MediaQueryListEvent): void => {
      setReduced(event.matches);
    };
    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
    };
  }, []);

  return reduced;
}
