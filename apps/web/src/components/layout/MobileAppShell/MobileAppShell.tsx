import type { ReactNode } from 'react';
import styles from './MobileAppShell.module.css';

/*
 * MobileAppShell — V5 D.3.32+ mobile chrome (skeleton).
 *
 * Why: mobile-only layout shell (caller mounts it for <768 viewports). Owns
 *      a flex column 100vh / dvh grid: topbar (fixed --mobile-topbar-h) +
 *      scrollable main + bottomNav (fixed --mobile-bottom-nav-h). The
 *      desktop AppShell already mounts MobileTopBar / BottomTabBar via its
 *      own slot mux on <768; this component is the alternative layout for
 *      callers that want a pure mobile shell (e.g. exam-specific chrome on
 *      mobile, future native wrappers). Safe-area insets are applied on the
 *      main scroll surface via env() so notch / home-indicator are respected.
 */

export interface MobileAppShellProps {
  readonly topbar?: ReactNode;
  readonly bottomNav?: ReactNode;
  readonly children: ReactNode;
}

export function MobileAppShell({ topbar, bottomNav, children }: MobileAppShellProps) {
  return (
    <div className={styles.shell} data-testid="mobile-app-shell">
      {topbar !== undefined ? (
        <div className={styles.topbar} data-testid="mobile-app-shell-topbar">
          {topbar}
        </div>
      ) : null}
      <main className={styles.main} data-testid="mobile-app-shell-main">
        {children}
      </main>
      {bottomNav !== undefined ? (
        <div className={styles.bottomNav} data-testid="mobile-app-shell-bottom">
          {bottomNav}
        </div>
      ) : null}
    </div>
  );
}
