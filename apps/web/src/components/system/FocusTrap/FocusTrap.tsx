import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

/*
 * FocusTrap — V5 D.3.34 a11y system layer (skeleton).
 *
 * Why: <Modal> / <Sheet> / <Drawer> must contain keyboard focus inside the
 *      overlay while open (WCAG 2.4.3). When `active` flips to true we move
 *      focus to `initialFocus` (or the first focusable child) and intercept
 *      Tab / Shift+Tab to wrap focus inside the container. When deactivated
 *      (or unmounted) we restore focus to whatever element had focus before
 *      activation.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface FocusTrapProps {
  readonly active: boolean;
  readonly initialFocus?: RefObject<HTMLElement | null>;
  readonly returnFocus?: boolean;
  readonly children: ReactNode;
}

export function FocusTrap({ active, initialFocus, returnFocus = true, children }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const target = initialFocus?.current ?? container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const nodes = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!nodes || nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || !container?.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !container?.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    const restore = previouslyFocusedRef.current;
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (returnFocus && restore && typeof restore.focus === 'function') {
        restore.focus();
      }
    };
  }, [active, initialFocus, returnFocus]);

  return <div ref={containerRef}>{children}</div>;
}
