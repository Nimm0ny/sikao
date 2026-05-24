/*
 * V5 overlay layer barrel.
 *
 * Why: single import surface for floating overlays so downstream components
 *      can pull Popover (and later Tooltip / Modal / Sheet / Drawer) from
 *      `@/components/overlay` without per-file relative imports. Wave 8
 *      (V5-M3) adds Banner (D.3.23, page-level alert).
 */
export { Popover } from './Popover';
export type { PopoverProps } from './Popover';

export { Tooltip } from './Tooltip';
export type { TooltipProps } from './Tooltip';

export { Banner } from './Banner';
export type { BannerProps, BannerVariant, BannerAction } from './Banner';

export { Modal } from './Modal';
export type { ModalProps, ModalPrimaryAction, ModalSecondaryAction } from './Modal';
