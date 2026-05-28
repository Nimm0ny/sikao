// lint-allow-ui-copy: V5 Profile sub-nav copy. CJK strings are visual contract
// from `.tmp_review/out/Tab5-Profile/Profile Learning v1.html` (sub-nav 8 pills).
import { Link } from 'react-router-dom';
import { ACCOUNT_NAV_ITEMS, type AccountNavKey } from './accountNav';
import styles from './SubNav.module.css';

/*
 * SubNav — Profile (Me) page shared sub-nav.
 *
 * Why: sik-fu-b §2.2 + sik-fu-c §2.2 — 8 tab pills shared across the
 *      Me / Profile page family. Active tab gets `data-active`. Routes
 *      that don't yet exist render as disabled spans (per drift §5 in
 *      sik-fu-b: routes are part of the broader Me phase). Item data comes
 *      from accountNav.ts so RailMe popover and SubNav cannot drift.
 *
 *      AGENT-H12: this is in-page sub-navigation for Profile pages only.
 *      It does NOT touch the global RootLayout/Rail/BottomTabBar navItems
 *      (which stay locked at the 4 [home, practice, review, note] tabs).
 *
 *      Active key drives which pill is highlighted; the rest are links.
 *      Caller must pass an active value. AGENT-H7: no fallback default.
 */

export type SubNavKey = AccountNavKey;

export interface SubNavProps {
  readonly active: SubNavKey;
}

export function SubNav({ active }: SubNavProps) {
  return (
    <nav className={styles.root} aria-label="账户子导航" data-testid="profile-sub-nav">
      <ul className={styles.list} role="list">
        {ACCOUNT_NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          if (!item.enabled) {
            return (
              <li key={item.key}>
                <span
                  className={styles.pill}
                  data-active={isActive || undefined}
                  data-disabled="true"
                  aria-disabled="true"
                  title="此入口尚未开放"
                >
                  {item.label}
                </span>
              </li>
            );
          }
          return (
            <li key={item.key}>
              <Link
                to={item.to}
                className={styles.pill}
                data-active={isActive || undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
