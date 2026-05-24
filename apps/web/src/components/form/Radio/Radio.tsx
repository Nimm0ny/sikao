import { useId } from 'react';
import type { ChangeEvent } from 'react';
import styles from './Radio.module.css';

/*
 * Radio — V5 D.3.12 form atom (skeleton).
 *
 * Why: native <input type="radio"> wrapped by <label> for free a11y
 *      binding (no need for htmlFor). Visual circle is rendered with a
 *      <span class="dot"> overlay that reads .input:checked via sibling
 *      selector; native input is visually hidden but not aria-hidden so
 *      keyboard / SR fall through to spec-defined behavior (Tab focus,
 *      Space toggle, arrow keys group nav inside same name=).
 *
 * NOTE: NOT for question-option ABCD (that's D.3.28 OptionItem). This is
 *       plain settings/forms.
 */

export type RadioSize = 'sm' | 'md';

export interface RadioProps {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly onChange: (v: string) => void;
  readonly label: string;
  readonly disabled?: boolean;
  readonly size?: RadioSize;
}

export function Radio({
  name,
  value,
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
}: RadioProps) {
  const id = useId();
  return (
    <label
      className={styles.root}
      data-size={size}
      data-disabled={disabled || undefined}
      data-checked={checked || undefined}
      htmlFor={id}
    >
      {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- wrapped by parent <label htmlFor={id}>{label}</label>; plugin can't trace cross-element label binding */}
      <input
        id={id}
        type="radio"
        className={styles.input}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (disabled) return;
          if (e.target.checked) onChange(value);
        }}
      />
      <span className={styles.circle} aria-hidden="true">
        <span className={styles.dot} />
      </span>
      <span className={styles.label}>{label}</span>
    </label>
  );
}
