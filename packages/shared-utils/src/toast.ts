// Imperative toast API + in-module event bus.
// The React host lives in `./ToastHost.tsx` to keep this file dep-free
// and to satisfy the `react-refresh/only-export-components` rule.

export type ToastKind = 'info' | 'warn' | 'error';

export interface ToastInput {
  readonly kind: ToastKind;
  readonly title: string;
  readonly description?: string;
  readonly duration?: number;
}

export interface ToastItem extends ToastInput {
  readonly id: number;
}

type Listener = (items: readonly ToastItem[]) => void;

const listeners = new Set<Listener>();
let queue: ToastItem[] = [];
let nextId = 1;

function notify(): void {
  for (const l of listeners) l(queue);
}

function push(input: ToastInput): number {
  const id = nextId++;
  const duration = input.duration ?? 3500;
  const item: ToastItem = { ...input, id };
  queue = [...queue, item];
  notify();
  window.setTimeout(() => dismiss(id), duration);
  return id;
}

export function dismiss(id: number): void {
  const before = queue.length;
  queue = queue.filter(t => t.id !== id);
  if (queue.length !== before) notify();
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  // Emit current state once so late subscribers see pending toasts.
  l(queue);
  return () => {
    listeners.delete(l);
  };
}

export const toast = {
  info: (title: string, description?: string) => push({ kind: 'info', title, description }),
  warn: (title: string, description?: string) => push({ kind: 'warn', title, description }),
  error: (title: string, description?: string) => push({ kind: 'error', title, description }),
  dismiss,
};
