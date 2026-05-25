import { useEffect, useState } from 'react';

/**
 * useMediaQuery — subscribe to a CSS media query via matchMedia.
 *
 * Why: standard matchMedia listener hook with SSR safe guard. Used by
 * AppShell to detect the 768–1023 tablet breakpoint (SIK-121 W3 H11).
 * Returns `true` when the query matches, `false` otherwise.
 *
 * SSR-safe: defaults to `false` when `window` is unavailable.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
