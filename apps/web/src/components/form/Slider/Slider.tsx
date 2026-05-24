import { useId } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import styles from './Slider.module.css';

/*
 * Slider — V5 D.3.15 form atom (skeleton).
 *
 * Why: typical use case is the practice-page font-size dial
 *      (marks: 紧凑 / 标准 / 大字 / 特大). We delegate keyboard, focus and
 *      touch interaction to the native <input type="range"> so a11y is
 *      free; only the track, fill, marks and value glyph are restyled.
 *      The fill is rendered by overlaying a linear-gradient on the track
 *      with width = (value - min) / (max - min) * 100%.
 *
 * Fail-fast (AGENT-H7):
 *   value out of [min, max] throws — caller is responsible for clamping
 *   their state. No silent saturation.
 */

export type SliderSize = 'sm' | 'md';

export interface SliderMark {
  readonly value: number;
  readonly label: string;
}

export interface SliderProps {
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly marks?: ReadonlyArray<SliderMark>;
  readonly showValue?: boolean;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
}

function formatValue(value: number, step: number): string {
  if (Number.isInteger(step)) return String(Math.round(value));
  // 1-decimal display for sub-integer steps (0.1 / 0.5 dial increments).
  return value.toFixed(1);
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  marks,
  showValue = false,
  disabled = false,
  'aria-label': ariaLabel,
}: SliderProps) {
  if (min >= max) {
    throw new Error('Slider: `min` must be strictly less than `max`');
  }
  if (value < min || value > max) {
    throw new Error(`Slider: value ${value} is outside [${min}, ${max}]`);
  }

  const id = useId();
  const fillPct = ((value - min) / (max - min)) * 100;
  const fillStyle: CSSProperties = { ['--slider-fill' as string]: `${fillPct}%` };

  return (
    <div
      className={styles.root}
      data-disabled={disabled || undefined}
      style={fillStyle}
    >
      <div className={styles.track}>
        <div className={styles.fill} aria-hidden="true" />
        {marks !== undefined && marks.length > 0 ? (
          <div className={styles.marks} aria-hidden="true">
            {marks.map((mark) => {
              const pct = ((mark.value - min) / (max - min)) * 100;
              const dotStyle: CSSProperties = { left: `${pct}%` };
              return (
                <span
                  key={mark.value}
                  className={styles.mark}
                  style={dotStyle}
                  data-active={mark.value <= value || undefined}
                >
                  <span className={styles.markDot} />
                  <span className={styles.markLabel}>{mark.label}</span>
                </span>
              );
            })}
          </div>
        ) : null}
        <input
          id={id}
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const next = Number(e.target.value);
            onChange(next);
          }}
        />
      </div>
      {showValue ? (
        <span className={styles.valueText} data-testid="slider-value">
          {formatValue(value, step)}
        </span>
      ) : null}
    </div>
  );
}
