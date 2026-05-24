import { useContext } from 'react';
import { ToastContext } from './ToastContext';
import type { ToastApi } from './ToastContext';

/*
 * useToast — hook for imperative toast surface.
 *
 * Why: kept in its own file so ToastProvider.tsx exports only the component
 *      (react-refresh/only-export-components). Throws fail-fast if used
 *      outside <ToastProvider> per AGENTS.md §4 fail-fast hard rule.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}
