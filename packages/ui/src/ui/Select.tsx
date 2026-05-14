import type { ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Frontend Style Guide v1 (PR3) primitive — editorial select.
//
// 规范 SSOT: docs/design/Frontend Style Guide.html §5 .select-box (lines ~380-403).
//   - border: 1px solid var(--line-3) / radius var(--r-tiny) / paper-1 bg
//   - md: padding 9px 12px / sm: padding 6px 10px
//   - placeholder color var(--ink-4) (via text-ink/4 utility)
//   - 内置 ▾ caret (JBMono / var(--ink-4))
//   - :focus-visible 走全局 outline (tokens.css :focus-visible 已就绪), 不重复.
//
// 实现选择: 包一层 div 模拟 chip 形态, 内部用原生 <select>. 保 a11y 默认 (键盘
// nav + 屏幕阅读器 + 平台 native dropdown), 不引入 portal / popper 复杂依赖.
//
// Dumb by contract (frontend/CLAUDE.md §2.2): 无 store / fetch; onChange 由 caller 处理.

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /** Required: 任何 SVG-only / 短 chip 形态控件必须 a11y label (CLAUDE.md §4 / frontend/CLAUDE.md §3.7). */
  readonly 'aria-label': string;
  readonly size?: 'sm' | 'md';
  readonly id?: string;
  readonly name?: string;
  readonly className?: string;
}

const SIZE: Record<NonNullable<SelectProps['size']>, string> = {
  // 规范 §5: md 9px 12px / sm 6px 10px — Tailwind 8px 阶梯就近取整 (§5.1 step rule)
  sm: 'px-3 py-1 text-meta',
  md: 'px-3 py-2 text-small',
};

// 整盒走 var(--line-3) 边 + var(--r-tiny) 4px radius + paper-1 底 + ink-1 字.
// 嵌套 ▾ caret 用 mono font + ink-4. value 空时降级 ink-4 占位色.
const BASE =
  'relative inline-flex items-center w-full min-w-[140px] ' +
  'bg-paper text-ink border border-line-3 rounded-tiny ' +
  'cursor-pointer transition-colors duration-fast ease-motion ' +
  'hover:border-ink focus-within:border-ink ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

// 真 <select> 透明叠在外盒上, 视觉走外盒, 交互走原生 select.
// arrow indicator 走 ::after 风格的 span (JBMono 字号 11 / ink-4).
const NATIVE =
  'absolute inset-0 w-full h-full opacity-0 cursor-pointer ' +
  'disabled:cursor-not-allowed';

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  size = 'md',
  id,
  name,
  className,
  ...rest
}: SelectProps): ReactNode {
  const ariaLabel = rest['aria-label'];
  const showPlaceholder = value === '' && placeholder !== undefined;
  const selected = options.find(o => o.value === value);
  const displayText = showPlaceholder ? placeholder : (selected?.label ?? value);

  return (
    <span
      className={cn(BASE, SIZE[size], disabled && 'opacity-50 cursor-not-allowed', className)}
      data-disabled={disabled || undefined}
    >
      <span
        className={cn(
          'flex-1 truncate font-sans',
          showPlaceholder ? 'text-ink-4' : 'text-ink-1',
        )}
      >
        {displayText}
      </span>
      <span
        aria-hidden="true"
        className="ml-2 font-mono text-tiny text-ink-4 select-none"
      >
        {'▾'}
      </span>
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.value)}
        className={NATIVE}
      >
        {showPlaceholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </span>
  );
}
