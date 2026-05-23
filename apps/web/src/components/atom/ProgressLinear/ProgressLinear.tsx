import styles from './ProgressLinear.module.css';

/*
 * ProgressLinear — V5 D.3.27 atom (skeleton).
 *
 * Why: deterministic + indeterminate horizontal progress bar. Track + fill
 *      both inherit variant tokens. Indeterminate falls back to a static
 *      50% fill under prefers-reduced-motion via the @keyframes fence in
 *      the module css; we *also* drop aria-valuenow so screen readers don't
 *      report a misleading static value when the work isn't bounded.
 */

export type ProgressVariant = 'brand' | 'ok' | 'warn' | 'err';
export type ProgressLinearSize = 'sm' | 'md' | 'lg';

export interface ProgressLinearProps {
  readonly value: number;
  readonly variant?: ProgressVariant;
  readonly size?: ProgressLinearSize;
  readonly showLabel?: boolean;
  readonly indeterminate?: boolean;
  readonly 'aria-label'?: string;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`ProgressLinear: value must be finite, got ${value}`);
  }
  return Math.min(100, Math.max(0, value));
}

export function ProgressLinear({
  value,
  variant = 'brand',
  size = 'md',
  showLabel = false,
  indeterminate = false,
  'aria-label': ariaLabel = '进度',
}: ProgressLinearProps) {
  const pct = clampPct(value);
  return (
    <div className={styles.root} data-size={size}>
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : pct}
        aria-busy={indeterminate || undefined}
        className={styles.track}
        data-variant={variant}
        data-indeterminate={indeterminate || undefined}
      >
        <div
          className={indeterminate ? styles.fillIndeterminate : styles.fill}
          style={indeterminate ? undefined : { width: `${pct}%` }}
          data-testid="progress-linear-fill"
        />
      </div>
      {showLabel ? (
        <span className={styles.label} data-testid="progress-linear-label">
          {Math.round(pct)}%
        </span>
      ) : null}
    </div>
  );
}
