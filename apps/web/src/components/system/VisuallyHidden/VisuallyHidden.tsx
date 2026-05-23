import type { ReactNode } from 'react';
import styles from './VisuallyHidden.module.css';

/*
 * VisuallyHidden — V5 D.3.34 a11y system layer (skeleton).
 *
 * Why: render content that is visually collapsed to 1px clip but remains
 *      announced by screen readers. Default element is <span> so it can
 *      be embedded inline next to icons / buttons without breaking flow.
 *      If callers need to hide block-level structure they should compose
 *      with a wrapping <div> outside this component.
 */

export interface VisuallyHiddenProps {
  readonly children: ReactNode;
}

export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return <span className={styles.hidden}>{children}</span>;
}
