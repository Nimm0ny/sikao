import type { ReactElement, ReactNode } from 'react';
import styles from './Badge.module.css';

/*
 * Badge — V5 D.3.8 atom (skeleton).
 *
 * Why: static label primitive used for status / categorical / count chips.
 *      Stays interaction-free; Tag and Chip extend Badge with `onRemove`.
 */

export type BadgeVariant =
  | 'neutral'
  | 'brand'
  | 'ok'
  | 'warn'
  | 'err'
  | 'info'
  | 'cat-yanyu'
  | 'cat-shuliang'
  | 'cat-panduan'
  | 'cat-ziliao'
  | 'cat-shenlun';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  readonly variant: BadgeVariant;
  readonly size?: BadgeSize;
  readonly leading?: ReactElement;
  readonly children: ReactNode;
}

export function Badge({ variant, size = 'md', leading, children }: BadgeProps) {
  return (
    <span className={styles.root} data-variant={variant} data-size={size}>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span>{children}</span>
    </span>
  );
}
