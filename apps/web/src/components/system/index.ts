/*
 * V5 D.3.34 a11y system layer barrel.
 *
 * Why: single import surface for system primitives so downstream components
 *      (Modal / Sheet / Drawer / Rail / CommandPalette) can pull all four
 *      from `@/components/system` without per-file relative imports.
 */
export { VisuallyHidden } from './VisuallyHidden';
export type { VisuallyHiddenProps } from './VisuallyHidden';

export { FocusTrap } from './FocusTrap';
export type { FocusTrapProps } from './FocusTrap';

export { Divider } from './Divider';
export type { DividerProps } from './Divider';

export { KeyboardShortcuts } from './KeyboardShortcuts';
export type {
  KeyboardShortcutsProps,
  ShortcutEntry,
  ShortcutScope,
} from './KeyboardShortcuts';
