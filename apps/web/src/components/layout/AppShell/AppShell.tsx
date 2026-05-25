import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BurgerDrawer } from '../BurgerDrawer';
import styles from './AppShell.module.css';

/*
 * AppShell — V5 D.3.32 layout (skeleton).
 *
 * Why: top-level layout shell. Desktop (≥1024) renders rail + workspace and
 *      hides topbar/bottomNav (mobile-only chrome); tablet (768–1023)
 *      renders BurgerDrawer placeholder instead of Rail (SIK-121 W3 H11);
 *      mobile (<768) hides rail and renders topbar + workspace + bottomNav.
 *      Visibility is driven by matchMedia subscriptions so the tree drops
 *      the rail slot entirely on mobile/tablet (Rail.module.css also
 *      display:none for defense in depth, but DOM removal stops Rail from
 *      spending state on mobile).
 */

const MOBILE_QUERY = '(max-width: 767.98px)';
const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023.98px)';

export interface AppShellProps {
  readonly rail?: ReactNode;
  readonly topbar?: ReactNode;
  readonly bottomNav?: ReactNode;
  readonly children: ReactNode;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(TABLET_QUERY).matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(TABLET_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsTablet(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isTablet;
}

export function AppShell({ rail, topbar, bottomNav, children }: AppShellProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  return (
    <div className={styles.shell} data-mobile={isMobile || undefined} data-testid="app-shell">
      {!isMobile && !isTablet && rail !== undefined ? rail : null}
      {isTablet ? <BurgerDrawer /> : null}
      <div className={styles.column}>
        {isMobile && topbar !== undefined ? (
          <div className={styles.topbar} data-testid="app-shell-topbar">{topbar}</div>
        ) : null}
        {children}
        {isMobile && bottomNav !== undefined ? (
          <div className={styles.bottomNav} data-testid="app-shell-bottom-nav">{bottomNav}</div>
        ) : null}
      </div>
    </div>
  );
}
