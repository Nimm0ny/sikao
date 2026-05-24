import type { ReactElement } from 'react';
import styles from './BottomTabBar.module.css';

/*
 * BottomTabBar — V5 D.3.32+ mobile chrome (skeleton).
 *
 * Why: bottom tab navigation (mobile primary nav). Glassmorphism is the
 *      default visual (rgba(255,255,255,.55) + backdrop-filter blur 18px /
 *      saturate 140%) per design.md §E.1; fallback to opaque
 *      --color-bg-elevated kicks in via @supports / prefers-reduced-
 *      transparency in BottomTabBar.module.css. The CSS-only fallback is
 *      the V5 sole approved fail-fast exception — registered at
 *      docs/engineering/fail-fast-exceptions.md#mobile-bottom-nav-glassmorphism-fallback.
 *      No try/catch / silent swallow / runtime feature-detection at this
 *      tier: the CSS engine owns the fallback path.
 */

export interface BottomTabBarItem {
  readonly id: string;
  readonly icon: ReactElement;
  readonly label: string;
  readonly href: string;
  readonly active?: boolean;
  readonly badge?: number;
}

export interface BottomTabBarProps {
  readonly items: readonly BottomTabBarItem[];
}

const MAX_ITEMS = 5;

export function BottomTabBar({ items }: BottomTabBarProps) {
  if (items.length === 0) {
    throw new Error('BottomTabBar: `items` must contain at least one entry');
  }
  if (items.length > MAX_ITEMS) {
    throw new Error(`BottomTabBar: \`items\` must contain at most ${MAX_ITEMS} entries`);
  }

  return (
    <nav
      role="navigation"
      aria-label="主导航"
      className={styles.nav}
      data-testid="bottom-tab-bar"
    >
      <ul className={styles.list} role="list">
        {items.map((item) => (
          <li key={item.id} className={styles.row}>
            <a
              href={item.href}
              className={styles.tab}
              data-active={item.active || undefined}
              data-testid={`bottom-tab-${item.id}`}
              aria-current={item.active ? 'page' : undefined}
              aria-label={
                item.badge !== undefined && item.badge > 0
                  ? `${item.label}（${item.badge} 条未读）`
                  : item.label
              }
            >
              <span className={styles.iconWrap} aria-hidden="true">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 ? (
                  <span
                    className={styles.badge}
                    data-testid={`bottom-tab-${item.id}-badge`}
                  />
                ) : null}
              </span>
              <span className={styles.label}>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
