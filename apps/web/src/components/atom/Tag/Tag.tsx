import type { ReactElement, ReactNode } from 'react';
import { Badge } from '../Badge/Badge';
import type { BadgeSize, BadgeVariant } from '../Badge/Badge';
import styles from './Tag.module.css';

/*
 * Tag — V5 D.3.8 atom (skeleton).
 *
 * Why: Badge's static visual + an optional close button. Used for filter
 *      facets / removable selections. `onRemove` toggles the button render.
 */

export interface TagProps {
  readonly variant: BadgeVariant;
  readonly size?: BadgeSize;
  readonly leading?: ReactElement;
  readonly children: ReactNode;
  readonly onRemove?: () => void;
  readonly removeAriaLabel?: string;
}

export function Tag({
  variant,
  size,
  leading,
  children,
  onRemove,
  removeAriaLabel = '移除',
}: TagProps) {
  return (
    <Badge variant={variant} size={size} leading={leading}>
      {children}
      {onRemove ? (
        <button
          type="button"
          className={styles.removeBtn}
          aria-label={removeAriaLabel}
          data-testid="tag-remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      ) : null}
    </Badge>
  );
}
