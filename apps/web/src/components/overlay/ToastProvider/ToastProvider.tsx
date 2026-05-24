import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactElement, ReactNode } from 'react';
import { Toast } from '../Toast';
import type { ToastVariant } from '../Toast';
import { ToastContext } from './ToastContext';
import type { ToastApi, ToastOptions } from './ToastContext';
import styles from './ToastProvider.module.css';

/*
 * ToastProvider — V5 D.3.7 overlay (skeleton, queue + portal).
 *
 * Why: Toast (D.3.7) is imperatively triggered (`useToast().toast({...})`),
 *      so a queue lives in a Provider that subtree-shares an imperative
 *      handle via context. The provider mounts a single fixed bottom-right
 *      stack via createPortal at z-toast (above modal). Each toast carries
 *      its own auto-dismiss timer; calling dismiss(id) clears the timer and
 *      removes the entry. variant=err defaults to 5000ms; the others 3000.
 *
 *      The hook (`useToast`) and context object live in sibling files so
 *      this module exports only the component (react-refresh/only-export-
 *      components contract).
 */

const DEFAULT_DURATION = 3000;
const ERR_DURATION = 5000;

interface ToastEntry {
  readonly id: string;
  readonly variant: ToastVariant;
  readonly title: string;
  readonly description?: string;
  readonly action?: ToastOptions['action'];
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `t-${Date.now().toString(36)}-${counter}`;
}

export interface ToastProviderProps {
  readonly children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): ReactElement {
  const [items, setItems] = useState<ReadonlyArray<ToastEntry>>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: ToastOptions): string => {
      const id = nextId();
      const variant: ToastVariant = opts.variant ?? 'info';
      const duration = opts.duration ?? (variant === 'err' ? ERR_DURATION : DEFAULT_DURATION);
      const entry: ToastEntry = {
        id,
        variant,
        title: opts.title,
        description: opts.description,
        action: opts.action,
      };
      setItems((prev) => [...prev, entry]);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss]);
  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {portalTarget !== null
        ? createPortal(
            <div className={styles.stack} data-testid="toast-stack">
              {items.map((t) => (
                <Toast
                  key={t.id}
                  id={t.id}
                  variant={t.variant}
                  title={t.title}
                  description={t.description}
                  action={t.action}
                  onDismiss={dismiss}
                />
              ))}
            </div>,
            portalTarget,
          )
        : null}
    </ToastContext.Provider>
  );
}
