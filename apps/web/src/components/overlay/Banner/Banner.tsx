import type { ReactElement } from 'react';
import styles from './Banner.module.css';

/*
 * Banner — V5 D.3.23 overlay (skeleton).
 *
 * Why: page-level persistent alert (e.g. "考试模式不可切换网络"). Distinct
 *      from Toast (D.3.7, transient floating). Banner is full-width and
 *      sits under the TopBar at the top of Workspace.
 *
 *      role="alert" for variant='err' (assertive SR), role="status" for
 *      info / ok / warn (polite SR). Inline default icon per variant uses
 *      stroke="currentColor" so the icon color follows the state-color
 *      ink the root pulls. action / dismiss buttons are minimal inline
 *      implementations (mirrors EmptyState pattern) so the overlay layer
 *      stays dep-free.
 */

export type BannerVariant = 'info' | 'ok' | 'warn' | 'err';

export interface BannerAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface BannerProps {
  readonly variant: BannerVariant;
  readonly title: string;
  readonly description?: string;
  readonly icon?: ReactElement;
  readonly action?: BannerAction;
  readonly dismissible?: boolean;
  readonly onDismiss?: () => void;
}

function DefaultIcon({ variant }: { readonly variant: BannerVariant }) {
  // Inline placeholder. V5-M4 sprite swap will replace these.
  if (variant === 'err') {
    return (
      <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 6v5M10 14v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === 'warn') {
    return (
      <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
        <path d="M10 2l8 14H2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M10 8v4M10 14v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === 'ok') {
    return (
      <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M6 10.5l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9v5M10 6v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Banner({
  variant,
  title,
  description,
  icon,
  action,
  dismissible = false,
  onDismiss,
}: BannerProps) {
  const role = variant === 'err' ? 'alert' : 'status';
  return (
    <div className={styles.root} data-variant={variant} role={role}>
      <span className={styles.icon}>{icon !== undefined ? icon : <DefaultIcon variant={variant} />}</span>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {description !== undefined ? <p className={styles.description}>{description}</p> : null}
      </div>
      {action !== undefined ? (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
      {dismissible ? (
        <button
          type="button"
          className={styles.dismiss}
          aria-label="关闭"
          data-testid="banner-dismiss"
          onClick={() => onDismiss?.()}
        >
          <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true" width="14" height="14">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
