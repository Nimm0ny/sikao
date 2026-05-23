import type { ReactNode } from 'react';
import styles from './ProgressRing.module.css';

/*
 * ProgressRing — V5 D.3.27 atom (skeleton).
 *
 * Why: SVG ring renders track + indicator circles. Stroke dash maths:
 *      circumference = 2πr; dash offset = circumference * (1 − value/100).
 *      Children render in the centered overlay div.
 */

export type ProgressRingSize = 'sm' | 'md' | 'lg';
export type ProgressRingVariant = 'brand' | 'ok' | 'warn' | 'err';

export interface ProgressRingProps {
  readonly value: number;
  readonly size?: ProgressRingSize;
  readonly strokeWidth?: number;
  readonly variant?: ProgressRingVariant;
  readonly children?: ReactNode;
}

const SIZE_PX: Record<ProgressRingSize, number> = {
  sm: 24,
  md: 40,
  lg: 64,
};

function clampPct(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`ProgressRing: value must be finite, got ${value}`);
  }
  return Math.min(100, Math.max(0, value));
}

export function ProgressRing({
  value,
  size = 'md',
  strokeWidth,
  variant = 'brand',
  children,
}: ProgressRingProps) {
  const px = SIZE_PX[size];
  const sw = strokeWidth ?? Math.round(px * 0.1);
  const r = (px - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = clampPct(value);
  const offset = c * (1 - pct / 100);
  return (
    <div
      className={styles.root}
      data-variant={variant}
      data-size={size}
      style={{ width: px, height: px }}
    >
      <svg
        className={styles.svg}
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <circle
          className={styles.track}
          cx={px / 2}
          cy={px / 2}
          r={r}
          strokeWidth={sw}
          fill="none"
        />
        <circle
          className={styles.indicator}
          cx={px / 2}
          cy={px / 2}
          r={r}
          strokeWidth={sw}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          data-testid="progress-ring-indicator"
        />
      </svg>
      {children !== undefined ? (
        <div className={styles.center} data-testid="progress-ring-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
