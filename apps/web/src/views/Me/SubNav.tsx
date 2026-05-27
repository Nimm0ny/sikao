// lint-allow-ui-copy: V5 Profile sub-nav copy. CJK strings are visual contract
// from `.tmp_review/out/Tab5-Profile/Profile Learning v1.html` (sub-nav 8 pills).
import { Link } from 'react-router-dom';
import styles from './SubNav.module.css';

/*
 * SubNav — Profile (Me) page shared sub-nav.
 *
 * Why: sik-fu-b §2.2 + sik-fu-c §2.2 — 8 tab pills shared across the
 *      Me / Profile page family. Active tab gets `data-active`. Routes
 *      that don't yet exist render as disabled spans (per drift §5 in
 *      sik-fu-b: routes are part of the broader Me phase).
 *
 *      AGENT-H12: this is in-page sub-navigation for Profile pages only.
 *      It does NOT touch the global RootLayout/Rail/BottomTabBar navItems
 *      (which stay locked at the 4 [home, practice, review, note] tabs).
 *
 *      Active key drives which pill is highlighted; the rest are links.
 *      Caller must pass an active value. AGENT-H7: no fallback default.
 */

export type SubNavKey =
  | 'overview'
  | 'info'
  | 'goals'
  | 'learning'
  | 'records'
  | 'preferences'
  | 'security'
  | 'settings';

interface SubNavItem {
  readonly key: SubNavKey;
  readonly label: string;
  readonly to: string;
  /** True when the route is implemented and reachable. */
  readonly enabled: boolean;
}

const NAV_ITEMS: ReadonlyArray<SubNavItem> = [
  { key: 'overview',    label: '概览',     to: '/me',                            enabled: true },
  { key: 'info',        label: '个人信息', to: '/me/info',                       enabled: false },
  { key: 'goals',       label: '考试目标', to: '/me/goals',                      enabled: false },
  { key: 'learning',    label: '学情',     to: '/profile/learning',              enabled: true },
  { key: 'records',     label: '学习记录', to: '/profile/records',               enabled: true },
  { key: 'preferences', label: '偏好',     to: '/profile/practice-preferences', enabled: true },
  { key: 'security',    label: '安全',     to: '/me/security',                   enabled: false },
  { key: 'settings',    label: '设置',     to: '/me/settings',                   enabled: false },
];

export interface SubNavProps {
  readonly active: SubNavKey;
}

export function SubNav({ active }: SubNavProps) {
  return (
    <nav className={styles.root} aria-label="账户子导航" data-testid="profile-sub-nav">
      <ul className={styles.list} role="list">
        {NAV_ITEMS.map((item) => {
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
