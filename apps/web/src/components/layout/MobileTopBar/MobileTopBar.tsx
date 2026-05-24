import type { ReactNode } from 'react';
import styles from './MobileTopBar.module.css';

/*
 * MobileTopBar — V5 D.3.32+ mobile chrome (skeleton).
 *
 * Why: mobile-app top banner. Two flanking slot wells (leading / trailing)
 *      plus a centered title. Renders as <header role="banner"> per
 *      design.md §D.3.32+ and the WAI-ARIA banner landmark contract.
 *      Padding-top consumes safe-area-inset-top so the iOS notch /
 *      Dynamic Island doesn't overlap the title; the slot height
 *      (--mobile-topbar-h) stays token-stable.
 */

export interface MobileTopBarProps {
  readonly title?: string;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
}

export function MobileTopBar({ title, leading, trailing }: MobileTopBarProps) {
  return (
    <header
      role="banner"
      className={styles.root}
      data-testid="mobile-topbar"
    >
      <div className={styles.leading} data-testid="mobile-topbar-leading">
        {leading !== undefined ? leading : null}
      </div>
      {title !== undefined ? (
        <h1 className={styles.title} data-testid="mobile-topbar-title">
          {title}
        </h1>
      ) : (
        <span className={styles.titleSpacer} aria-hidden="true" />
      )}
      <div className={styles.trailing} data-testid="mobile-topbar-trailing">
        {trailing !== undefined ? trailing : null}
      </div>
    </header>
  );
}
