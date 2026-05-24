/*
 * V5 overlay layer barrel.
 *
 * Why: single import surface for floating overlays so downstream components
 *      can pull Popover (and later Tooltip / Modal / Sheet / Drawer) from
 *      `@/components/overlay` without per-file relative imports. Wave 11
 *      (V5-M3) adds Sheet (D.3.5), Drawer (D.3.21), ConfirmDialog (D.3.22),
 *      and Toast / ToastProvider (D.3.7).
 */
export { Popover } from './Popover';
export type { PopoverProps } from './Popover';

export { Tooltip } from './Tooltip';
export type { TooltipProps } from './Tooltip';

export { Banner } from './Banner';
export type { BannerProps, BannerVariant, BannerAction } from './Banner';

export { Modal } from './Modal';
export type { ModalProps, ModalPrimaryAction, ModalSecondaryAction } from './Modal';

export { Sheet } from './Sheet';
export type { SheetProps } from './Sheet';

export { Drawer } from './Drawer';
export type { DrawerProps } from './Drawer';

export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';

export { Toast } from './Toast';
export type { ToastViewProps, ToastVariant, ToastAction } from './Toast';

export { ToastProvider, useToast } from './ToastProvider';
export type { ToastProviderProps, ToastApi, ToastOptions } from './ToastProvider';

export { CommandPalette } from './CommandPalette';
export type {
  CommandPaletteProps,
  CommandPaletteGroup,
  CommandPaletteItem,
} from './CommandPalette';
