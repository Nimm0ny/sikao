import type { ReactElement } from 'react';
import styles from './Toast.module.css';

/*
 * Toast — V5 D.3.7 overlay (skeleton, single item).
 *
 * Why: transient floating notice. Distinct from Banner (persistent, page-
 *      level): Toast auto-dismisses after duration ms, stacks bottom-right
 *      under z-toast layer. The single-item view here is rendered by
 *      ToastProvider — the queue + dismiss timer + portal mount belong to
 *      the provider so each Toast stays purely visual.
 *
 *      State role wiring:
 *        variant='err'      → role="alert" + aria-live="assertive"
 *        info / ok / warn   → role="status" + aria-live="polite"
 *
 *      Action / dismiss buttons are inline minimal (mirrors Banner pattern)
 *      so the overlay layer stays free of reverse dependency on form atoms.
 */

export type ToastVariant = 'info' | 'ok' | 'warn' | 'err';

export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface ToastViewProps {
  readonly id: string;
  readonly variant: ToastVariant;
  readonly title: string;
  readonly description?: string;
  readonly action?: ToastAction;
  readonly onDismiss: (id: string) => void;
}

export function Toast({
  id,
  variant,
  title,
  description,
  action,
  onDismiss,
}: ToastViewProps): ReactElement {
  const isErr = variant === 'err';
  const role = isErr ? 'alert' : 'status';
  const ariaLive = isErr ? 'assertive' : 'polite';
  return (
    <div
      className={styles.root}
      data-variant={variant}
      data-testid={`toast-${id}`}
      role={role}
      aria-live={ariaLive}
    >
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {description !== undefined ? <p className={styles.description}>{description}</p> : null}
      </div>
      {action !== undefined ? (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
      <button
        type="button"
        className={styles.dismiss}
        aria-label="关闭"
        data-testid={`toast-dismiss-${id}`}
        onClick={() => onDismiss(id)}
      >
        <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true" width="14" height="14">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
