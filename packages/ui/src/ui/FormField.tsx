import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef, useId } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.2 primitive — editorial underline form field.
// 参考 element/preview/forms.html：
//   - 无 box，仅 border-bottom hairline
//   - focus 时 border-bottom 加粗到 2px + 变 ink
//   - label 在上方（label + 可选 aux mono 小字）
//   - hint 在下方（mono 小字）/ error 红色
//
// Dumb：不维护 value / 不做校验；caller 传 value + onChange。
// 提供 forwardRef 以便 react-hook-form 等库使用。

export interface FormFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  readonly label: ReactNode;
  /** 右侧 mono 辅助字，如 "+86" / "6 位" / "必填"。 */
  readonly auxLabel?: ReactNode;
  /** 下方提示文本（hint 灰色 mono）。 */
  readonly hint?: ReactNode;
  /** 错误文本；存在时优先展示且 input 边色变 danger。 */
  readonly error?: ReactNode;
  /** 整体行容器附加 class。Input 本身的 class 请传 `inputClassName`。 */
  readonly rootClassName?: string;
  readonly inputClassName?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  {
    label,
    auxLabel,
    hint,
    error,
    id,
    rootClassName,
    inputClassName,
    className,
    disabled,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? `ff-${generatedId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = error != null ? errorId : hint != null ? hintId : undefined;

  return (
    <div className={cn('flex flex-col gap-2', rootClassName)}>
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-ink tracking-[0.01em] flex items-baseline" // hardcode-allow: form label fine-tune
      >
        <span>{label}</span>
        {auxLabel != null ? (
          <span className="ml-2 text-tiny font-medium font-mono text-ink-4 tracking-loose">
            {auxLabel}
          </span>
        ) : null}
      </label>
      <input
        ref={ref}
        id={inputId}
        disabled={disabled}
        aria-invalid={error != null || undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-11 px-1 py-3',
          'font-sans text-md text-ink bg-transparent',
          'border-0 border-b outline-none rounded-none',
          'transition-[border-color,border-bottom-width] duration-fast ease-motion',
          'placeholder:text-line-3',
          error != null
            ? 'border-b-danger focus:border-b-danger focus:border-b-2 focus:pb-2'
            : 'border-b-line-strong hover:border-b-placeholder focus:border-b-ink focus:border-b-2 focus:pb-2',
          disabled && 'opacity-60 cursor-not-allowed',
          inputClassName,
          className,
        )}
        {...rest}
      />
      {error != null ? (
        <span id={errorId} className="text-tiny font-mono text-err tracking-loose">
          {error}
        </span>
      ) : hint != null ? (
        <span id={hintId} className="text-tiny font-mono text-ink-4 tracking-loose">
          {hint}
        </span>
      ) : null}
    </div>
  );
});
