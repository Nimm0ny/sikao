import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './BurgerDrawer.module.css';

/*
 * BurgerDrawer — V5 SIK-121 W3 H11 placeholder.
 *
 * Why: 768–1023 tablet breakpoint replaces the collapsed 80px Rail with a
 * burger button + empty drawer. This is a placeholder — the full drawer
 * content (nav list, Me entry) belongs to a future Mobile/Tablet Shell
 * issue. This wave only provides the hook + toggle mechanism.
 *
 * Contract: docs/plan/sik-rail-v5-visual-contract.md §2.5 + §6 H11.
 */

export interface BurgerDrawerProps {
  readonly children?: ReactNode;
}

export function BurgerDrawer({ children }: BurgerDrawerProps) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-label="打开导航"
        aria-expanded={open}
        data-testid="burger-trigger"
        onClick={toggle}
      >
        <span className={styles.bar} aria-hidden="true" />
        <span className={styles.bar} aria-hidden="true" />
        <span className={styles.bar} aria-hidden="true" />
      </button>
      <aside
        className={styles.drawer}
        aria-hidden={!open}
        data-open={open || undefined}
        data-testid="burger-drawer"
      >
        <button
          type="button"
          className={styles.close}
          aria-label="关闭导航"
          onClick={close}
        >
          ✕
        </button>
        {children}
      </aside>
    </>
  );
}
