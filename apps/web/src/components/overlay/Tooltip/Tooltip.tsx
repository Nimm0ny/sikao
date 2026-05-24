import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

/*
 * Tooltip — V5 D.3.19 overlay (skeleton).
 *
 * Why: hover-device-only floating label. Coarse-pointer (touch) devices opt
 *      out — design.md §D.3.19 mandates a long-press Sheet there, but Sheet
 *      (D.3.5) is not yet landed, so the touch branch renders children
 *      verbatim with no listeners. Hover-capable: mouseenter starts delayIn
 *      timer; focus opens immediately (kbd a11y); shortcut chips render as
 *      <kbd> per design gotcha §D.3.35 (icon-only button must pair Tooltip).
 *
 * TODO(V5-M3 D.3.5 Sheet): once Sheet lands, swap the touch-branch null
 *      listener set for a long-press 700ms recogniser that opens a Sheet.
 */

type Side = 'top' | 'right' | 'bottom' | 'left';
type Align = 'start' | 'center' | 'end';

export interface TooltipProps {
  readonly content: string | ReactNode;
  readonly side?: Side;
  readonly align?: Align;
  readonly delayIn?: number;
  readonly delayOut?: number;
  readonly shortcut?: readonly string[];
  readonly children: ReactElement;
}

interface Coords { readonly top: number; readonly left: number }

function computeCoords(t: DOMRect, p: DOMRect, side: Side, align: Align): Coords {
  const gap = 8;
  let top = 0, left = 0;
  if (side === 'bottom') top = t.bottom + gap;
  else if (side === 'top') top = t.top - p.height - gap;
  else if (side === 'right') left = t.right + gap;
  else left = t.left - p.width - gap;
  if (side === 'top' || side === 'bottom') {
    left = align === 'start' ? t.left : align === 'end' ? t.right - p.width : t.left + (t.width - p.width) / 2;
  } else {
    top = align === 'start' ? t.top : align === 'end' ? t.bottom - p.height : t.top + (t.height - p.height) / 2;
  }
  return { top: top + window.scrollY, left: left + window.scrollX };
}

export function Tooltip({ content, side = 'top', align = 'center', delayIn = 600, delayOut = 200, shortcut, children }: TooltipProps) {
  if (!isValidElement(children)) throw new Error('Tooltip: `children` must be a valid React element');
  const tooltipId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const isTouch = useMemo(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
    [],
  );
  const setTriggerRef = useCallback((node: HTMLElement | null) => { triggerRef.current = node; }, []);
  const clearTimers = useCallback(() => { if (showTimer.current) clearTimeout(showTimer.current); if (hideTimer.current) clearTimeout(hideTimer.current); showTimer.current = null; hideTimer.current = null; }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);
  useLayoutEffect(() => {
    if (!open) return;
    const tEl = triggerRef.current, pEl = panelRef.current;
    if (!tEl || !pEl) return;
    setCoords(computeCoords(tEl.getBoundingClientRect(), pEl.getBoundingClientRect(), side, align));
  }, [open, side, align, content]);

  // eslint-disable-next-line react-hooks/refs -- ref must travel via cloneElement so consumers don't have to forwardRef their trigger element
  if (isTouch) return cloneElement(children as ReactElement<Record<string, unknown>>, { ref: setTriggerRef });

  const cp = children.props as { onMouseEnter?: (e: unknown) => void; onMouseLeave?: (e: unknown) => void; onFocus?: (e: unknown) => void; onBlur?: (e: unknown) => void; 'aria-describedby'?: string };
  const injected: Record<string, unknown> = {
    ref: setTriggerRef,
    onMouseEnter: (e: unknown) => {
      cp.onMouseEnter?.(e);
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
      hideTimer.current = null;
      showTimer.current = setTimeout(() => setOpen(true), delayIn);
    },
    onMouseLeave: (e: unknown) => {
      cp.onMouseLeave?.(e);
      if (showTimer.current !== null) clearTimeout(showTimer.current);
      showTimer.current = null;
      hideTimer.current = setTimeout(() => setOpen(false), delayOut);
    },
    onFocus: (e: unknown) => { cp.onFocus?.(e); clearTimers(); setOpen(true); },
    onBlur: (e: unknown) => { cp.onBlur?.(e); clearTimers(); setOpen(false); },
    'aria-describedby': open ? tooltipId : cp['aria-describedby'],
  };
  // eslint-disable-next-line react-hooks/refs -- ref must travel via cloneElement so consumers don't have to forwardRef their trigger element
  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, injected);
  const panelStyle: CSSProperties = coords === null ? { visibility: 'hidden' } : { top: coords.top, left: coords.left };
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  return (
    <>
      {trigger}
      {open && portalTarget
        ? createPortal(
            <div ref={panelRef} id={tooltipId} role="tooltip" data-tooltip-panel="true" data-side={side} data-align={align} className={styles.panel} style={panelStyle}>
              <span className={styles.content}>{content}</span>
              {shortcut && shortcut.length > 0 ? (
                <span className={styles.shortcut} data-testid="tooltip-shortcut">
                  {shortcut.map((k, i) => <kbd key={i} className={styles.kbd}>{k}</kbd>)}
                </span>
              ) : null}
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
}
