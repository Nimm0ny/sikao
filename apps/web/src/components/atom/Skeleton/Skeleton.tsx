import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

/*
 * Skeleton — V5 D.3.10 atom (skeleton).
 *
 * Why: pulse-animated placeholder block. `text` variant emits N stub lines
 *      (last line trimmed to 60% width) so consumers can model paragraph
 *      shells. prefers-reduced-motion freezes the pulse to a static .5 alpha.
 */

export type SkeletonVariant = 'text' | 'rect' | 'circle';

export interface SkeletonProps {
  readonly variant?: SkeletonVariant;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly lines?: number;
}

function resolve(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return `${value}px`;
  return value;
}

export function Skeleton({
  variant = 'rect',
  width,
  height,
  lines,
}: SkeletonProps) {
  if (variant === 'text') {
    const count = lines ?? 1;
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error(`Skeleton: lines must be a positive integer, got ${lines}`);
    }
    return (
      <div className={styles.textGroup} data-testid="skeleton-text-group">
        {Array.from({ length: count }, (_, idx) => {
          const isLast = idx === count - 1 && count > 1;
          const lineStyle: CSSProperties = {
            width: isLast ? '60%' : resolve(width) ?? '100%',
            height: resolve(height) ?? '12px',
          };
          return (
            <span
              key={idx}
              className={styles.block}
              data-variant="text"
              style={lineStyle}
            />
          );
        })}
      </div>
    );
  }

  const style: CSSProperties = {
    width: resolve(width) ?? (variant === 'circle' ? '32px' : '100%'),
    height: resolve(height) ?? (variant === 'circle' ? '32px' : '16px'),
  };
  return <span className={styles.block} data-variant={variant} style={style} />;
}
