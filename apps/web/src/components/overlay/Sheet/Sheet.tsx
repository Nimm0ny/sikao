import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react';
import { FocusTrap } from '../../system/FocusTrap';
import styles from './Sheet.module.css';

/*
 * Sheet — V5 D.3.5 overlay (skeleton).
 *
 * Why: bottom-rising panel for mobile ("半屏 / 全屏"). Sheet differs from
 *      Modal in 3 ways: bottom-anchored, draggable-to-dismiss, top-only
 *      rounded (var(--card-radius-lg) = 22px). Sheet differs from Drawer
 *      by being bottom-only and content-driven height ('auto').
 *
 *      State machine per §D.3.5: closed / opening / open / dragging / closing.
 *      Skeleton stage collapses opening/closing into open/closed and only
 *      tracks `dragging` when draggable=true and a pointer drag is active —
 *      transitions land in a later wave (CP.6 motion).
 *
 *      Body scroll lock + Esc + FocusTrap follow the same pattern as Modal
 *      (own implementation, NOT delegated to Modal — Sheet's chrome differs).
 *      Drag-to-dismiss: pointerdown on the panel arms tracking, pointermove
 *      updates `dragY` (only positive = downward), pointerup → if dragY >
 *      30% of panel height, fire onClose; otherwise snap back to 0.
 */

const HALF_MAX_VH = 50;        // variant='half' → max 50vh
const FULL_OFFSET_LIMIT = 100; // variant='full' → 100vh - safe-area
const DISMISS_THRESHOLD = 0.3; // pointerup deltaY > 30% panelHeight → close

export interface SheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly variant?: 'half' | 'full' | 'auto';
  readonly draggable?: boolean;
  readonly title?: string;
  readonly trailingAction?: ReactElement;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export function Sheet({
  open,
  onClose,
  variant = 'auto',
  draggable = false,
  title,
  trailingAction,
  children,
  footer,
}: SheetProps) {
  const reactId = useId();
  const titleId = `sheet-title-${reactId}`;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

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

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    dragStartYRef.current = e.clientY;
    setDragging(true);
    // jsdom lacks setPointerCapture; guard so tests don't throw.
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggable || dragStartYRef.current === null) return;
    const delta = e.clientY - dragStartYRef.current;
    setDragY(delta > 0 ? delta : 0);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggable || dragStartYRef.current === null) return;
    const panelH = panelRef.current?.getBoundingClientRect().height ?? 0;
    const finalDelta = e.clientY - dragStartYRef.current;
    dragStartYRef.current = null;
    setDragging(false);
    if (typeof e.currentTarget.releasePointerCapture === 'function') {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (panelH > 0 && finalDelta / panelH > DISMISS_THRESHOLD) {
      // Reset drag offset before close so reopen starts at 0.
      setDragY(0);
      onClose();
      return;
    }
    setDragY(0);
  };

  const panelStyle: CSSProperties = {
    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
  };

  return createPortal(
    <div className={styles.overlay} data-testid="sheet-overlay" role="presentation" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <FocusTrap active={open}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title !== undefined ? titleId : undefined}
          aria-label={title === undefined ? '抽屉面板' : undefined}
          className={styles.panel}
          data-variant={variant}
          data-half-vh={variant === 'half' ? HALF_MAX_VH : undefined}
          data-full-limit={variant === 'full' ? FULL_OFFSET_LIMIT : undefined}
          data-dragging={dragging || undefined}
          style={panelStyle}
        >
          {/* Drag handle is the only drag-initiating surface; the handle wrapper
            * carries pointer listeners so jsx-a11y does not flag the dialog. */}
          <div
            className={styles.handleArea}
            data-testid="sheet-handle-area"
            role="presentation"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className={styles.handle} aria-hidden="true" data-testid="sheet-handle" />
          </div>
          {title !== undefined || trailingAction !== undefined ? (
            <div className={styles.header}>
              {title !== undefined ? (
                <h2 id={titleId} className={styles.title}>{title}</h2>
              ) : <span />}
              {trailingAction !== undefined ? <div className={styles.trailing}>{trailingAction}</div> : null}
            </div>
          ) : null}
          <div className={styles.body}>{children}</div>
          {footer !== undefined ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      </FocusTrap>
    </div>,
    portalTarget,
  );
}
