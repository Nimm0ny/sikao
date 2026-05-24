import { useId } from 'react';
import type { ChangeEvent } from 'react';
import styles from './Switch.module.css';

/*
 * Switch — V5 D.3.12 form atom (skeleton).
 *
 * Why: native <input type="checkbox"> with role="switch" + aria-checked.
 *      Native handles Space toggle + Tab focus for free; we visually
 *      hide the input and render a token-driven track + thumb. The track
 *      slides via CSS transition on translate; reduced-motion zeroes
 *      --dur-base at the token layer (§1.7) so animation collapses to a
 *      static state-swap.
 */

export type SwitchSize = 'sm' | 'md';

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly size?: SwitchSize;
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
}: SwitchProps) {
  const id = useId();
  return (
    <label
      className={styles.root}
      data-size={size}
      data-disabled={disabled || undefined}
      data-checked={checked || undefined}
      htmlFor={id}
    >
      {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- wrapped by parent <label htmlFor={id}>{label}</label>; plugin can't trace cross-element label binding (label is optional here per Switch spec) */}
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (disabled) return;
          onChange(e.target.checked);
        }}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {label !== undefined ? <span className={styles.label}>{label}</span> : null}
    </label>
  );
}
