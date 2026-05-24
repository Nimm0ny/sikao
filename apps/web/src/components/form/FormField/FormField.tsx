import { Children } from 'react';
import type { ReactElement } from 'react';
import styles from './FormField.module.css';

/*
 * FormField — V5 D.3.16 form wrapper (skeleton).
 *
 * Why: spec mandates that every form control sit inside a FormField; bare
 *      <label> + <input> is forbidden. Layout is label → control → helper /
 *      error footer with vertical rhythm via --space-2 (close to the spec's
 *      6px guidance, snapping to the V5 spacing scale).
 *
 * Fail-fast: helper + error are mutually exclusive (spec §D.3.16). We throw
 *      eagerly so dev catches it in development; downstream pages won't
 *      silently swallow the helper. `htmlFor` is optional — we recommend it
 *      for a11y but do NOT throw, because some controls (Combobox / Slider /
 *      DatePicker compound triggers) own their own internal id via React
 *      Children.only.
 */

export interface FormFieldProps {
  readonly label: string;
  readonly required?: boolean;
  readonly helper?: string;
  readonly error?: string;
  readonly htmlFor?: string;
  readonly children: ReactElement;
}

export function FormField({
  label,
  required = false,
  helper,
  error,
  htmlFor,
  children,
}: FormFieldProps) {
  if (helper !== undefined && error !== undefined) {
    throw new Error('FormField: `helper` and `error` are mutually exclusive');
  }
  // React.Children.only validates that we received exactly one element; this
  // mirrors the contract in the spec ("children: ReactElement").
  const only = Children.only(children);

  const hasError = error !== undefined && error.length > 0;
  const hasHelper = !hasError && helper !== undefined && helper.length > 0;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        <span>{label}</span>
        {required ? (
          <span className={styles.required} aria-hidden="true">*</span>
        ) : null}
      </label>
      {only}
      {hasError ? (
        <span className={styles.error} role="alert" data-testid="formfield-error">
          {error}
        </span>
      ) : null}
      {hasHelper ? (
        <span className={styles.helper} data-testid="formfield-helper">
          {helper}
        </span>
      ) : null}
    </div>
  );
}
