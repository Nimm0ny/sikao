import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Frontend Style Guide v1 (PR3) primitive — editorial chip toggle.
//
// 规范 SSOT: docs/design/Frontend Style Guide.html §5 .chip-btn (line ~418-424).
//   .chip-btn {
//     border: 1px solid var(--line-3); border-radius: var(--r-pill);
//     padding: 5px 13px; font: 400 12px/1 'Source Serif 4';
//     color: var(--ink-2); background: var(--paper-1); cursor: pointer;
//   }
//   .chip-btn:hover { border-color: var(--ink-1); color: var(--ink-1); }
//   .chip-btn.is-on { background: var(--ink-1); color: var(--paper-1); border-color: var(--ink-1); }
//
// 注: chip 走 serif 跟"类目编辑"语义对齐 (规范注释强调). 跟 Pill (italic 只读 tag) 解耦,
// 跟 Badge (status badge) 解耦, 跟 Button (primary action) 解耦.
//
// `aria-pressed` 由 caller 控制 (toggle 语义); 不强制走 required prop (允许 fire-and-forget chip).
//
// Dumb by contract (frontend/CLAUDE.md §2.2): 无 store / fetch; onClick 由 caller 处理.

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  readonly children: ReactNode;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly size?: 'sm' | 'md';
}

const SIZE: Record<NonNullable<ChipProps['size']>, string> = {
  // 规范 §5 .chip-btn padding 5px 13px (md). Tailwind 8px 阶梯就近取整 (§5.1).
  // sm 缩字号 (tiny) + 减横向 padding; md 字 (meta) + 标准.
  sm: 'px-2 py-1 text-tiny',
  md: 'px-3 py-1 text-meta',
};

const BASE =
  'inline-flex items-center rounded-pill border font-serif font-normal leading-none ' +
  'cursor-pointer transition-colors duration-fast ease-motion ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2 focus-visible:ring-offset-2';

const UNSELECTED =
  'border-line-3 bg-paper-1 text-ink-2 ' +
  'hover:border-ink-1 hover:text-ink-1';

const SELECTED =
  'border-ink-1 bg-ink-1 text-paper-1 ' +
  'hover:bg-ink-2 hover:border-ink-2';

export function Chip({
  children,
  selected = false,
  disabled = false,
  onClick,
  size = 'md',
  className,
  ...rest
}: ChipProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={rest['aria-pressed'] ?? selected}
      data-selected={selected || undefined}
      className={cn(BASE, SIZE[size], selected ? SELECTED : UNSELECTED, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
