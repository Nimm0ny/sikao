import { useEffect, useId, useRef } from 'react';
import type { ChangeEvent } from 'react';
import styles from './Checkbox.module.css';

/*
 * Checkbox — V5 D.3.12 form atom (skeleton).
 *
 * Why: native <input type="checkbox"> wrapped by <label>. Indeterminate is
 *      a DOM-only property (not an HTML attribute), so we sync it via
 *      useEffect on every render where checked === 'indeterminate'.
 *      Visual checkmark / dash is rendered by sibling .box overlay using
 *      data-state attr fed from JSX.
 */

export type CheckboxState = boolean | 'indeterminate';
export type CheckboxSize = 'sm' | 'md';

export interface CheckboxProps {
  readonly checked: CheckboxState;
  readonly onChange: (checked: boolean) => void;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly size?: CheckboxSize;
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
}: CheckboxProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isIndeterminate = checked === 'indeterminate';
  const isChecked = checked === true;

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  const state = isIndeterminate ? 'indeterminate' : isChecked ? 'checked' : 'unchecked';

  return (
    <label
      className={styles.root}
      data-size={size}
      data-disabled={disabled || undefined}
      data-state={state}
      htmlFor={id}
    >
      {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- wrapped by parent <label htmlFor={id}>{label}</label>; plugin can't trace cross-element label binding (label is optional here per Checkbox spec) */}
      <input
        id={id}
        ref={inputRef}
        type="checkbox"
        className={styles.input}
        checked={isChecked}
        disabled={disabled}
        aria-checked={isIndeterminate ? 'mixed' : isChecked}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
      />
      <span className={styles.box} aria-hidden="true">
        <svg className={styles.icon} viewBox="0 0 16 16" focusable="false">
          {isIndeterminate ? (
            <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path
              d="M3.5 8.5l3 3 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </span>
      {label !== undefined ? <span className={styles.label}>{label}</span> : null}
    </label>
  );
}
