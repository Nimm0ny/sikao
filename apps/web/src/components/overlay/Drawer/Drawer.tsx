import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from 'react';
import { Button } from '../../form/Button';
import { FocusTrap } from '../../system/FocusTrap';
import styles from './Drawer.module.css';

/*
 * Drawer — V5 D.3.21 overlay (skeleton).
 *
 * Why: side-anchored panel for desktop. Same lifecycle primitives as Modal /
 *      Sheet (createPortal + FocusTrap + Esc + body scroll lock) but with
 *      its own implementation — Drawer's chrome (no rounded corners, side
 *      anchor, full-height, slide-from-edge) differs enough that delegating
 *      to Modal would force conditional logic on the consumer side. Note
 *      detail (R2/Q1) hard-requires Drawer; mobile callers still get
 *      Drawer (the same component) but typically with side='bottom'.
 *
 *      side determines the slide-from edge: left/right anchor the panel
 *      flush to that edge with full height; top/bottom anchor flush to
 *      that edge with full width. size maps to fixed widths (left/right)
 *      or heights (top/bottom): sm=360 / md=480 / lg=640 / full=100%.
 */

const SIZE_MAP: Record<'sm' | 'md' | 'lg' | 'full', string> = {
  sm: '360px',
  md: '480px',
  lg: '640px',
  full: '100%',
};

export interface DrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly side?: 'left' | 'right' | 'top' | 'bottom';
  readonly size?: 'sm' | 'md' | 'lg' | 'full';
  readonly title?: string;
  readonly trailingAction?: ReactElement;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Drawer({
  open,
  onClose,
  side = 'right',
  size = 'md',
  title,
  trailingAction,
  children,
  footer,
}: DrawerProps) {
  const reactId = useId();
  const titleId = `drawer-title-${reactId}`;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  const handleOverlayClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isHorizontal = side === 'left' || side === 'right';
  const sizeStyle = isHorizontal
    ? { width: SIZE_MAP[size] }
    : { height: SIZE_MAP[size] };

  return createPortal(
    <div
      className={styles.overlay}
      data-testid="drawer-overlay"
      data-side={side}
      role="presentation"
      onClick={handleOverlayClick}
    >
      <FocusTrap active={open}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title !== undefined ? titleId : undefined}
          aria-label={title === undefined ? '抽屉面板' : undefined}
          className={styles.panel}
          data-side={side}
          data-size={size}
          data-testid="drawer-panel"
          style={sizeStyle}
        >
          <div className={styles.header}>
            {title !== undefined ? (
              <h2 id={titleId} className={styles.title}>{title}</h2>
            ) : <span className={styles.titleSpacer} />}
            <div className={styles.headerActions}>
              {trailingAction !== undefined ? (
                <div className={styles.trailing}>{trailingAction}</div>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                iconOnly={<CloseIcon />}
                aria-label="关闭"
                onClick={onClose}
              />
            </div>
          </div>
          <div className={styles.body}>{children}</div>
          {footer !== undefined ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      </FocusTrap>
    </div>,
    portalTarget,
  );
}
