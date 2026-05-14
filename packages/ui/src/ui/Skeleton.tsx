import { cn } from '@sikao/shared-utils';

// Phase 4.1 primitive — a single shimmering block to compose loading
// placeholders. Dumb by contract (frontend/CLAUDE.md §2.2): no business
// imports, no state. Caller sizes it with Tailwind width/height classes.
//
// Why CSS-only `animate-pulse` and not a framer-motion shimmer: this file
// ships in phase 4.1; framer-motion only arrives in 4.2. Keeping 4.1
// dependency-free lets Skeleton land on its own commit and work even if
// 4.2 gets deferred.

export type SkeletonVariant = 'rect' | 'circle' | 'text';

export interface SkeletonProps {
  /** Shape: default `rect`; `circle` ignores rounded class; `text` auto-sizes height. */
  readonly variant?: SkeletonVariant;
  /** Tailwind width class, e.g. `w-full` / `w-32`. Defaults to `w-full`. */
  readonly widthClass?: string;
  /** Tailwind height class, e.g. `h-4` / `h-24`. Ignored when `variant='text'`. */
  readonly heightClass?: string;
  /** Tailwind rounded class. Ignored when `variant='circle'`. Defaults to `rounded-card`. */
  readonly roundedClass?: string;
  readonly testId?: string;
  readonly className?: string;
}

export function Skeleton({
  variant = 'rect',
  widthClass = 'w-full',
  heightClass,
  roundedClass = 'rounded-card',
  testId,
  className,
}: SkeletonProps) {
  const size = variant === 'text' ? 'h-4' : (heightClass ?? 'h-4');
  const rounded = variant === 'circle' ? 'rounded-pill' : roundedClass;
  return (
    <div
      role="presentation"
      aria-hidden="true"
      data-testid={testId}
      className={cn('bg-line/70 animate-pulse', widthClass, size, rounded, className)}
    />
  );
}
