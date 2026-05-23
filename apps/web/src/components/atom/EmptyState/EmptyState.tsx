import styles from './EmptyState.module.css';
import { renderIllustration } from './EmptyStateIllustration';
import type { Illustration } from './EmptyStateIllustration';

/*
 * EmptyState — V5 D.3.10 atom (skeleton).
 *
 * Why: drop-in placeholder block for "no data / no result / error /
 *      first-time" empty surfaces. Inlines a minimal primary action button
 *      (NOT the D.3.1 Button) to keep the atom layer dep-free.
 */

export interface EmptyStatePrimaryAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface EmptyStateProps {
  readonly illustration?: Illustration;
  readonly title: string;
  readonly description?: string;
  readonly primaryAction?: EmptyStatePrimaryAction;
}

export function EmptyState({
  illustration = 'no-data',
  title,
  description,
  primaryAction,
}: EmptyStateProps) {
  return (
    <div className={styles.root} role="status">
      <div className={styles.illustration} data-illustration={illustration}>
        {renderIllustration(illustration)}
      </div>
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {primaryAction ? (
        <button type="button" className={styles.action} onClick={primaryAction.onClick}>
          {primaryAction.label}
        </button>
      ) : null}
    </div>
  );
}
