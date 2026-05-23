import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Popover.module.css';

/*
 * Popover — V5 D.3.20 overlay (skeleton).
 *
 * Why: floating surface anchored to a trigger element. Skeleton stage owns
 *      portal render + click-outside dismissal + side/align coordinate math
 *      via getBoundingClientRect; collision detection is deferred to a
 *      later wave (design §D.3.20 simply notes "箭头可选").
 */

type Side = 'top' | 'right' | 'bottom' | 'left';
type Align = 'start' | 'center' | 'end';

export interface PopoverProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly trigger: ReactElement;
  readonly side?: Side;
  readonly align?: Align;
  readonly width?: number | 'auto' | 'trigger';
  readonly closeOnClickOutside?: boolean;
  readonly children: ReactNode;
}

interface TriggerInjectedProps {
  readonly 'aria-haspopup': true;
  readonly 'aria-expanded': boolean;
  readonly onClick: (e: ReactMouseEvent<HTMLElement>) => void;
  readonly ref: (node: HTMLElement | null) => void;
}

interface Coords {
  readonly top: number;
  readonly left: number;
}

function computeCoords(
  triggerRect: DOMRect,
  panelRect: DOMRect,
  side: Side,
  align: Align,
): Coords {
  const gap = 8;
  let top = 0;
  let left = 0;
  if (side === 'bottom') {
    top = triggerRect.bottom + gap;
  } else if (side === 'top') {
    top = triggerRect.top - panelRect.height - gap;
  } else if (side === 'right') {
    left = triggerRect.right + gap;
  } else {
    left = triggerRect.left - panelRect.width - gap;
  }

  if (side === 'top' || side === 'bottom') {
    if (align === 'start') left = triggerRect.left;
    else if (align === 'end') left = triggerRect.right - panelRect.width;
    else left = triggerRect.left + (triggerRect.width - panelRect.width) / 2;
  } else {
    if (align === 'start') top = triggerRect.top;
    else if (align === 'end') top = triggerRect.bottom - panelRect.height;
    else top = triggerRect.top + (triggerRect.height - panelRect.height) / 2;
  }
  return { top: top + window.scrollY, left: left + window.scrollX };
}

function resolveWidth(width: PopoverProps['width'], triggerRect: DOMRect | null): number | undefined {
  if (typeof width === 'number') return width;
  if (width === 'trigger' && triggerRect) return triggerRect.width;
  return undefined;
}

export function Popover({
  open,
  onOpenChange,
  trigger,
  side = 'bottom',
  align = 'start',
  width = 'auto',
  closeOnClickOutside = true,
  children,
}: PopoverProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [resolvedWidth, setResolvedWidth] = useState<number | undefined>(undefined);

  const setTriggerRef = useCallback((node: HTMLElement | null) => {
    triggerRef.current = node;
  }, []);

  if (!isValidElement(trigger)) {
    throw new Error('Popover: `trigger` must be a valid React element');
  }
  const triggerProps = trigger.props as { onClick?: (e: ReactMouseEvent<HTMLElement>) => void };
  const injected: TriggerInjectedProps = {
    'aria-haspopup': true,
    'aria-expanded': open,
    onClick: (e) => {
      triggerProps.onClick?.(e);
      onOpenChange(!open);
    },
    ref: setTriggerRef,
  };
  // eslint-disable-next-line react-hooks/refs -- trigger-based pattern: callback ref must be injected via cloneElement so the consumer can pass any element as `trigger` without forwarding refs themselves
  const clonedTrigger = cloneElement(trigger, injected);

  useLayoutEffect(() => {
    if (!open) return;
    const triggerEl = triggerRef.current;
    const panel = panelRef.current;
    if (!triggerEl || !panel) return;
    const triggerRect = triggerEl.getBoundingClientRect();
    setResolvedWidth(resolveWidth(width, triggerRect));
    const panelRect = panel.getBoundingClientRect();
    setCoords(computeCoords(triggerRect, panelRect, side, align));
  }, [open, side, align, width, children]);

  useEffect(() => {
    if (!open || !closeOnClickOutside) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onOpenChange(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, closeOnClickOutside, onOpenChange]);

  const panelStyle: CSSProperties =
    coords === null
      ? { visibility: 'hidden' }
      : {
          top: coords.top,
          left: coords.left,
          width: resolvedWidth,
        };

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <>
      {clonedTrigger}
      {open && portalTarget
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              data-popover-panel="true"
              data-side={side}
              data-align={align}
              className={styles.panel}
              style={panelStyle}
            >
              {children}
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
}
