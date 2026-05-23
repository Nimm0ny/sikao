import styles from './Divider.module.css';

/*
 * Divider — V5 D.3.34 a11y system layer (skeleton).
 *
 * Why: separator line driven by V5 border tokens. orientation switches the
 *      thickness axis; variant maps to subtle / default / strong border
 *      tokens; inset (horizontal only) trims the start/end by --space-4 so
 *      the line aligns with card body content rather than card chrome.
 */

export interface DividerProps {
  readonly orientation?: 'horizontal' | 'vertical';
  readonly variant?: 'subtle' | 'default' | 'strong';
  readonly inset?: boolean;
}

export function Divider({
  orientation = 'horizontal',
  variant = 'default',
  inset = false,
}: DividerProps) {
  const classes = [
    styles.divider,
    orientation === 'vertical' ? styles.vertical : styles.horizontal,
    styles[`variant-${variant}`],
    inset && orientation === 'horizontal' ? styles.inset : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      data-orientation={orientation}
      data-variant={variant}
      data-inset={inset ? 'true' : 'false'}
      className={classes}
    />
  );
}
