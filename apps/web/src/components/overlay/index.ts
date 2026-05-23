/*
 * V5 overlay layer barrel.
 *
 * Why: single import surface for floating overlays so downstream components
 *      can pull Popover (and later Tooltip / Modal / Sheet / Drawer) from
 *      `@/components/overlay` without per-file relative imports.
 */
export { Popover } from './Popover';
export type { PopoverProps } from './Popover';
