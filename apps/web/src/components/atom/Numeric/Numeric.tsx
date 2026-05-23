import styles from './Numeric.module.css';

/*
 * Numeric — V5 D.3.9 atom (skeleton).
 *
 * Why: deliver consistently-formatted numbers (tabular-nums, thousand
 *      separator, precision) with optional unit + trend glyph. Fail-fast on
 *      NaN/Infinity so callers cannot silently propagate broken stats.
 */

export type NumericSize = 'meta' | 'body' | 'card' | 'h3' | 'h2' | 'h1' | 'display';
export type NumericEmphasis = 'value' | 'unit' | 'balanced';
export type NumericTrend = 'up' | 'down' | 'flat';

export interface NumericProps {
  readonly value: number | string;
  readonly unit?: string;
  readonly precision?: number;
  readonly thousand?: boolean;
  readonly size?: NumericSize;
  readonly emphasis?: NumericEmphasis;
  readonly trend?: NumericTrend;
}

const TREND_GLYPH: Record<NumericTrend, string> = {
  up: '▲',
  down: '▼',
  flat: '–',
};

function formatValue(value: number | string, precision: number | undefined, thousand: boolean): string {
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) {
    throw new Error(`Numeric: value must be finite, got ${value}`);
  }
  const formatter = new Intl.NumberFormat('en-US', {
    useGrouping: thousand,
    minimumFractionDigits: precision ?? 0,
    maximumFractionDigits: precision ?? 20,
  });
  return formatter.format(value);
}

export function Numeric({
  value,
  unit,
  precision,
  thousand = true,
  size = 'body',
  emphasis = 'balanced',
  trend,
}: NumericProps) {
  const formatted = formatValue(value, precision, thousand);
  return (
    <span
      className={styles.root}
      data-size={size}
      data-emphasis={emphasis}
      data-trend={trend}
    >
      {trend ? (
        <span className={styles.trend} aria-hidden="true">
          {TREND_GLYPH[trend]}
        </span>
      ) : null}
      <span className={styles.value}>{formatted}</span>
      {unit ? <span className={styles.unit}>{unit}</span> : null}
    </span>
  );
}
