import { useId } from 'react';
import type { ReactNode } from 'react';
import styles from './Panel.module.css';

/*
 * Panel — V5 D.3.33 container (skeleton).
 *
 * Why: card-shaped section container. Renders a <section> when title is
 *      present (so the title h3 can pair with aria-labelledby) and a <div>
 *      otherwise (avoiding a sectioning element with no accessible name).
 *      `trailing` slot lives inline with the title — typical use is a
 *      `<Tabs variant="panel">` or an icon button row. `noPadding` lets
 *      the body host its own grid (e.g. Table); `variant="danger"` flips
 *      the border to --color-state-err for destructive contexts.
 */

export interface PanelProps {
  readonly title?: string;
  readonly trailing?: ReactNode;
  readonly children: ReactNode;
  readonly noPadding?: boolean;
  readonly variant?: 'default' | 'danger';
  readonly 'aria-label'?: string;
}

export function Panel({
  title,
  trailing,
  children,
  noPadding = false,
  variant = 'default',
  'aria-label': ariaLabel,
}: PanelProps) {
  const reactId = useId();
  const titleId = title ? `panel-title-${reactId}` : undefined;
  const body = (
    <div
      className={styles.body}
      data-no-padding={noPadding || undefined}
      data-testid="panel-body"
    >
      {children}
    </div>
  );

  if (title !== undefined) {
    return (
      <section
        className={styles.root}
        data-variant={variant}
        data-testid="panel"
        aria-labelledby={titleId}
        aria-label={ariaLabel}
      >
        <header className={styles.header}>
          <h3 id={titleId} className={styles.title}>{title}</h3>
          {trailing !== undefined ? (
            <div className={styles.trailing} data-testid="panel-trailing">{trailing}</div>
          ) : null}
        </header>
        {body}
      </section>
    );
  }

  return (
    <div
      className={styles.root}
      data-variant={variant}
      data-testid="panel"
      aria-label={ariaLabel}
    >
      {body}
    </div>
  );
}
