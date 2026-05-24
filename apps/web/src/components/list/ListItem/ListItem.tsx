import type { ReactElement } from 'react';
import styles from './ListItem.module.css';

/*
 * ListItem — V5 D.3.4 list atom (skeleton).
 *
 * Why: row primitive for sidebars / settings panels / drag-sortable lists.
 *      Visual contract: leading slot + (title + subtitle) stack + trailing
 *      slot, with optional drag-handle prefixed when draggable=true.
 *
 *      We render a <button> when onPress is provided (so keyboard activation
 *      works for free), and a <div role="listitem"> otherwise (purely
 *      decorative row). The 6 visual states (rest / hover / pressed /
 *      selected / disabled / dragging-handle) are driven by data-* attrs +
 *      CSS pseudo-classes; selected adds a 4px brand accent bar on the
 *      leading edge.
 */

export type ListItemSize = 'sm' | 'md' | 'lg';

export interface ListItemProps {
  readonly size?: ListItemSize;
  readonly leading?: ReactElement;
  readonly title: string;
  readonly subtitle?: string;
  readonly trailing?: ReactElement;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
  readonly draggable?: boolean;
  readonly 'aria-label'?: string;
}

function DragHandle() {
  // 6-dots placeholder; V5-M4 sprite swap will replace this inline SVG.
  return (
    <span className={styles.dragHandle} aria-hidden="true" data-testid="listitem-drag-handle">
      <svg viewBox="0 0 8 14" focusable="false" width="8" height="14">
        <circle cx="2" cy="2" r="1" fill="currentColor" />
        <circle cx="6" cy="2" r="1" fill="currentColor" />
        <circle cx="2" cy="7" r="1" fill="currentColor" />
        <circle cx="6" cy="7" r="1" fill="currentColor" />
        <circle cx="2" cy="12" r="1" fill="currentColor" />
        <circle cx="6" cy="12" r="1" fill="currentColor" />
      </svg>
    </span>
  );
}

export function ListItem({
  size = 'md',
  leading,
  title,
  subtitle,
  trailing,
  selected = false,
  disabled = false,
  onPress,
  draggable = false,
  'aria-label': ariaLabel,
}: ListItemProps) {
  const interactive = onPress !== undefined;
  const dataAttrs = {
    'data-size': size,
    'data-selected': selected || undefined,
    'data-disabled': disabled || undefined,
    'data-draggable': draggable || undefined,
  } as const;

  const inner = (
    <>
      {draggable ? <DragHandle /> : null}
      {leading !== undefined ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        {subtitle !== undefined ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
      {trailing !== undefined ? <span className={styles.trailing}>{trailing}</span> : null}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={styles.root}
        {...dataAttrs}
        disabled={disabled}
        aria-pressed={selected || undefined}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled && onPress) onPress();
        }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={styles.root} role="listitem" aria-label={ariaLabel} {...dataAttrs}>
      {inner}
    </div>
  );
}
