import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Button } from '../../form/Button';
import { FocusTrap } from '../../system/FocusTrap';
import styles from './Modal.module.css';

/*
 * Modal — V5 D.3.6 overlay (skeleton).
 *
 * Why: page-blocking dialog rendered via createPortal to document.body so
 *      the surface escapes ancestor stacking contexts. Skeleton stage owns
 *      the open / closed dichotomy; opening / closing transitions land in a
 *      later wave (spec §D.3.6 4-state machine collapses to open/closed at
 *      the skeleton level).
 *
 *      <FocusTrap active={open}> wraps the dialog so keyboard focus stays
 *      inside (D.3.34). Esc keydown triggers onClose while open. body
 *      scroll lock toggles document.body.style.overflow='hidden' on open
 *      and restores the prior value on close / unmount (D.3.35 gotcha).
 *      closeOnOverlay=true (default) closes via overlay click; false leaves
 *      it inert. The atom layer does NOT enforce closeOnOverlay+danger
 *      coupling — the caller is responsible per spec.
 */

const SIZE_MAX_WIDTH: Record<'sm' | 'md' | 'lg', number> = { sm: 360, md: 480, lg: 640 };

export interface ModalPrimaryAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly variant?: 'primary' | 'danger';
}
export interface ModalSecondaryAction {
  readonly label: string;
  readonly onClick: () => void;
}
export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly primaryAction: ModalPrimaryAction;
  readonly secondaryAction?: ModalSecondaryAction;
  readonly closeOnOverlay?: boolean;
  readonly children?: ReactNode;
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Modal({
  open, onClose, title, description, size = 'md',
  primaryAction, secondaryAction, closeOnOverlay = true, children,
}: ModalProps) {
  const reactId = useId();
  const titleId = `modal-title-${reactId}`;
  const descId = `modal-desc-${reactId}`;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  // Only react to direct overlay clicks; clicks on the panel bubble here too
  // but with currentTarget !== target on the overlay.
  const handleOverlayClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!closeOnOverlay) return;
    if (e.target === e.currentTarget) onClose();
  };

  const primaryVariant: 'primary' | 'danger' = primaryAction.variant ?? 'primary';

  return createPortal(
    <div
      className={styles.overlay}
      data-testid="modal-overlay"
      // Modal scrim click-to-close is a canonical W3C dialog pattern; the focusable
      // surface is the inner role="dialog" wrapped by FocusTrap. The scrim itself
      // stays decorative (role="presentation") so it does NOT compete with the dialog
      // for SR announcement, and Esc on document handles keyboard close in parallel
      // (see useEffect above). The role="presentation" satisfies jsx-a11y/no-static-
      // element-interactions without forcing tabIndex onto the scrim.
      role="presentation"
      onClick={handleOverlayClick}
    >
      <FocusTrap active={open}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description !== undefined ? descId : undefined}
          className={styles.dialog}
          data-size={size}
          style={{ maxWidth: SIZE_MAX_WIDTH[size] }}
        >
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            <Button variant="ghost" size="sm" iconOnly={<CloseIcon />} aria-label="关闭" onClick={onClose} />
          </div>
          {description !== undefined ? (
            <p id={descId} className={styles.description}>{description}</p>
          ) : null}
          {children !== undefined ? <div className={styles.body}>{children}</div> : null}
          <div className={styles.footer}>
            {secondaryAction !== undefined ? (
              <Button variant="secondary" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>
            ) : null}
            <Button variant={primaryVariant} onClick={primaryAction.onClick}>{primaryAction.label}</Button>
          </div>
        </div>
      </FocusTrap>
    </div>,
    portalTarget,
  );
}
