import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEventHandler } from 'react';
import styles from './Textarea.module.css';

/*
 * Textarea — V5 D.3.11 form atom (skeleton).
 *
 * Why: multi-line text surface for shenlun answer / note edit. Reuses
 *      input-* tokens (§4.3) so single-line Input + multi-line Textarea
 *      share rest/focus/invalid chrome. Two height modes, mutex per
 *      design.md §D.3.11:
 *        - rows: fixed line count, native attr, resize: vertical
 *        - autosize: { min, max } → measured via scrollHeight, clamped
 *          to [min*lh, max*lh]
 *      `showCount` lights --color-state-warn at >= 90% maxLength.
 *      Fail-fast: passing both `rows` and `autosize` throws.
 */

export type TextareaSize = 'sm' | 'md' | 'lg';

export interface TextareaAutosize {
  readonly min?: number;
  readonly max?: number;
}

export interface TextareaProps {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly size?: TextareaSize;
  readonly rows?: number;
  readonly autosize?: TextareaAutosize;
  readonly maxLength?: number;
  readonly showCount?: boolean;
  readonly placeholder?: string;
  readonly invalid?: boolean;
  readonly errorText?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly 'aria-label'?: string;
  readonly autoFocus?: boolean;
  readonly onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
}

// Line-height in px, paired with .textarea font-size + line-height rules
// in Textarea.module.css; translates row counts into pixel clamps.
const LINE_HEIGHT_PX: Record<TextareaSize, number> = { sm: 18, md: 21, lg: 24 };

function clamp(raw: number, autosize: TextareaAutosize, size: TextareaSize): number {
  const lh = LINE_HEIGHT_PX[size];
  const minPx = autosize.min !== undefined ? autosize.min * lh : raw;
  const maxPx = autosize.max !== undefined ? autosize.max * lh : raw;
  if (raw < minPx) return minPx;
  if (raw > maxPx) return maxPx;
  return raw;
}

export function Textarea({
  value,
  onChange,
  size = 'md',
  rows,
  autosize,
  maxLength,
  showCount = false,
  placeholder,
  invalid = false,
  errorText,
  disabled = false,
  readOnly = false,
  'aria-label': ariaLabel,
  autoFocus = false,
  onKeyDown,
}: TextareaProps) {
  if (rows !== undefined && autosize !== undefined) {
    throw new Error('Textarea: `rows` and `autosize` are mutually exclusive');
  }

  const reactId = useId();
  const helperId = `textarea-${reactId}-helper`;
  const countId = `textarea-${reactId}-count`;
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // autosize: reset height for shrink, read scrollHeight, clamp, apply.
  // useLayoutEffect avoids a flash between value commit + resize.
  useLayoutEffect(() => {
    if (autosize === undefined) return;
    const node = ref.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${clamp(node.scrollHeight, autosize, size)}px`;
  }, [value, autosize, size]);

  // Initial mount: empty autosize textarea must start at min row band so
  // shenlun edit surface (min: 8) does not collapse to 1 line.
  useEffect(() => {
    if (autosize === undefined) return;
    const node = ref.current;
    if (!node || node.value.length > 0) return;
    if (autosize.min !== undefined) {
      node.style.height = `${autosize.min * LINE_HEIGHT_PX[size]}px`;
    }
  }, [autosize, size]);

  const helperText = invalid ? errorText : undefined;
  const ids: string[] = [];
  if (helperText !== undefined) ids.push(helperId);
  if (showCount && maxLength !== undefined) ids.push(countId);
  const describedBy = ids.length > 0 ? ids.join(' ') : undefined;
  const warn = maxLength !== undefined ? Math.floor(maxLength * 0.9) : Infinity;
  const overWarn = showCount && value.length >= warn;

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.root}
        data-size={size}
        data-disabled={disabled || undefined}
        data-readonly={readOnly || undefined}
        data-invalid={invalid || undefined}
        data-mode={autosize !== undefined ? 'autosize' : 'rows'}
      >
        <textarea
          ref={ref}
          className={styles.textarea}
          value={value}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          aria-label={ariaLabel}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          onKeyDown={onKeyDown}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        />
        {showCount && maxLength !== undefined ? (
          <span
            id={countId}
            className={styles.count}
            data-warn={overWarn || undefined}
            data-testid="textarea-count"
          >
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
      {helperText !== undefined ? (
        <span id={helperId} className={styles.helper} data-kind="error">
          {helperText}
        </span>
      ) : null}
    </div>
  );
}
