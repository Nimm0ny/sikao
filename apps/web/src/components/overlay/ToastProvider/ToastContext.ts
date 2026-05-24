import { createContext } from 'react';
import type { ToastAction, ToastVariant } from '../Toast';

/*
 * ToastContext — internal context object for ToastProvider / useToast.
 *
 * Why: react-refresh/only-export-components requires the provider file to
 *      export ONLY the component. The context object + types live here so
 *      the provider and the hook can both reach them without violating the
 *      single-export rule.
 */

export interface ToastOptions {
  readonly variant?: ToastVariant;
  readonly title: string;
  readonly description?: string;
  readonly duration?: number;
  readonly action?: ToastAction;
}

export interface ToastApi {
  readonly toast: (opts: ToastOptions) => string;
  readonly dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
