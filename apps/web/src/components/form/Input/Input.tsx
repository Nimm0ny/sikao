import { useId } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import styles from './Input.module.css';

/*
 * Input — V5 D.3.2 form atom (skeleton).
 *
 * Why: single line text/number/password/search input with prefix/suffix
 *      slots + invalid/success message slot. Visual contract is fully
 *      token-driven (§4.3 component layer: --input-h-md / --input-radius /
 *      --input-padding-x / --input-bg / --input-border / --input-ring-focus).
 *      CSS module owns size/state mappings via data-* attrs; the inner
 *      <input> uses min-width:0 + box-sizing:border-box per §D.3.35 gotcha
 *      so prefix/suffix flex slots never push it out of its container.
 *
 * State machine (7 states per design.md §D.3.2):
 *   rest / focus / filled / disabled / read-only / error / success
 *
 * a11y:
 *   - errorText / successText render <span id> and feed aria-describedby.
 *   - invalid=true sets aria-invalid="true" so SR reports validation failure.
 *   - When neither errorText nor successText is set but `aria-label` is,
 *     the input still gets it (icon-only inputs e.g. search header).
 */

export type InputType = 'text' | 'number' | 'password' | 'search';
export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps {
  readonly type?: InputType;
  readonly size?: InputSize;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly invalid?: boolean;
  readonly errorText?: string;
  readonly successText?: string;
  readonly prefix?: ReactNode;
  readonly suffix?: ReactNode;
  readonly id?: string;
  readonly name?: string;
  readonly 'aria-label'?: string;
}

export function Input({
  type = 'text',
  size = 'md',
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  invalid = false,
  errorText,
  successText,
  prefix,
  suffix,
  id,
  name,
  'aria-label': ariaLabel,
}: InputProps) {
  const reactId = useId();
  const inputId = id ?? `input-${reactId}`;
  const helperId = `${inputId}-helper`;
  const filled = value.length > 0;
  // error visual is gated by `invalid`; successText alone shows ok visual
  // ONLY when not invalid (error always wins per §D.3.2 state precedence).
  const showError = invalid;
  const showSuccess = !invalid && (successText !== undefined && successText.length > 0);
  const helperKind = showError ? 'error' : showSuccess ? 'success' : null;
  const helperText = showError ? errorText : showSuccess ? successText : undefined;
  const describedBy = helperText !== undefined ? helperId : undefined;

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.root}
        data-size={size}
        data-disabled={disabled || undefined}
        data-readonly={readOnly || undefined}
        data-invalid={showError || undefined}
        data-success={showSuccess || undefined}
        data-filled={filled || undefined}
      >
        {prefix !== undefined ? (
          <span className={styles.prefix} data-testid="input-prefix">
            {prefix}
          </span>
        ) : null}
        <input
          id={inputId}
          name={name}
          type={type}
          className={styles.input}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          aria-label={ariaLabel}
          aria-invalid={showError ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
        {suffix !== undefined ? (
          <span className={styles.suffix} data-testid="input-suffix">
            {suffix}
          </span>
        ) : null}
      </div>
      {helperKind !== null && helperText !== undefined ? (
        <span id={helperId} className={styles.helper} data-kind={helperKind}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
}
