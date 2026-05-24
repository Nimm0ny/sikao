/*
 * V5 atom layer barrel.
 *
 * Why: single import surface for atomic visual primitives so downstream
 *      modules (Card / Form / Toolbar) can pull `@/components/atom` without
 *      per-file relative imports. Wave 6 lands Avatar / Badge / Tag / Chip /
 *      Numeric / ProgressLinear / ProgressRing / EmptyState / Skeleton.
 */
export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { Tag } from './Tag';
export type { TagProps } from './Tag';

export { Chip } from './Chip';
export type { ChipProps } from './Chip';

export { Numeric } from './Numeric';
export type { NumericProps, NumericSize, NumericEmphasis, NumericTrend } from './Numeric';

export { ProgressLinear } from './ProgressLinear';
export type {
  ProgressLinearProps,
  ProgressLinearSize,
  ProgressVariant,
} from './ProgressLinear';

export { ProgressRing } from './ProgressRing';
export type {
  ProgressRingProps,
  ProgressRingSize,
  ProgressRingVariant,
} from './ProgressRing';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStatePrimaryAction } from './EmptyState';

export { Skeleton } from './Skeleton';
export type { SkeletonProps, SkeletonVariant } from './Skeleton';

export { SpriteIcon } from './SpriteIcon';
export type { SpriteIconProps } from './SpriteIcon';
