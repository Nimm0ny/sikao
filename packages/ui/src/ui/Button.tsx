import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.1 rebrand: expanded variants per element/preview/buttons.html.
// 设计稿四档：primary(ink) / secondary(outline) / accent(blue, 仅关键 CTA) / quiet(text link)。
// 本文件保留旧变体名（ink / ghost）作向后兼容 —— views 不需改动；
// 新代码请优先用 primary / secondary / accent / quiet。
//
// Dumb by contract (frontend/CLAUDE.md §2.2): 无 store / fetch；onClick 由 caller 处理。

export type ButtonVariant =
  | 'primary'    // 主按钮：ink 黑底 + 白字。Phase 5.0 后 --brand = ink 黑。
  | 'ink'        // Alias of `primary`（视觉等价，保留避免 views 大改）。
  | 'ghost'      // 旧 outline：白底 + line 边 + muted 字。柔和风。
  | 'secondary'  // 新 outline：白底 + ink 边 + ink 字，hover 反色。对比更强。
  | 'accent'     // 新蓝色：bg-accent + 白字。**仅用于单一最重要 CTA**（如"交卷"）。
  | 'danger'     // 危险操作：danger 红底 + 白字。**仅用于不可撤回的危险操作**。
  | 'quiet';     // 新 link 样：无 box，text link + hover underline。

export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly leftIcon?: ReactNode;
  readonly rightIcon?: ReactNode;
  readonly isLoading?: boolean;
  readonly fullWidth?: boolean;
  /**
   * Toggled "on" state — Frontend Style Guide v1 PR3 (parity with IconBtn.is-on).
   * 跟 variant 解耦, 任何 variant 配 active=true 都给 button 加 `data-active="true"`
   * + 视觉 hint (ink 反白). 典型用法: toggle 工具按钮 / tab-like 切换 / sticky toolbar 当前态.
   */
  readonly active?: boolean;
}

// Border 对 solid 变体默认 transparent；outline 变体覆盖；quiet 不画边。
// Brand v2 (2026-05-08 PR2): focus-visible 加 ring-offset-4 = outline-offset 4px
// (a11y AA, design-system-v2-spec §7.2.4 + §9.1). transition 走 fast token 让
// ring 进出 + bg 变色都在 var(--motion-fast) (150ms) 节奏一致.
const BASE_SOLID =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-tiny border ' +
  'transition-[color,background-color,border-color,box-shadow] duration-fast ease-motion ' +
  'disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-accent-50 focus-visible:ring-offset-4';

// quiet 不是盒子：纯 text link，无边无 padding；focus 走 underline 示意。
const BASE_QUIET =
  'inline-flex items-center gap-2 font-medium transition-colors duration-fast ease-motion ' +
  'disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none ' +
  'focus-visible:underline underline-offset-4';

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
};

const SIZE_QUIET: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-sm',
};

const VARIANT: Record<ButtonVariant, string> = {
  // Phase 5.0 后 bg-ink-1 = ink 黑，primary 自动从蓝变黑。
  primary: 'bg-ink-1 text-white border-transparent hover:bg-ink-1',
  // `ink` 是 `primary` 的历史别名（phase 4 前旧 views 用），视觉等价。
  ink: 'bg-ink-1 text-white border-transparent hover:bg-ink-1',
  // 旧 ghost：柔和 outline。views 层保留引用。
  ghost: 'bg-surface text-ink-3 border-line hover:bg-surface-alt hover:border-line-3',
  // secondary：element spec 的强 outline 次级按钮。
  // "查看我的错题" 这种不是主操作但也要显眼的用它。
  secondary: 'bg-surface text-ink border-ink hover:bg-ink hover:text-white',
  // accent：element spec —— reserved for the single most-important moment。
  // 页面级全局至多出现 1 次（交卷 / 支付确认 / 不可撤回的提交）。
  accent: 'bg-accent text-white border-transparent hover:brightness-95',
  // danger：危险操作（如答题卡底部"交卷"按钮）。Figma node 11:3 Drawer Footer。
  danger: 'bg-err text-white border-transparent hover:brightness-95',
  // quiet：text link 样。caller 可 rightIcon={<span className="font-serif italic">→</span>}
  // 做 editorial 箭头。
  quiet: 'text-ink-3 hover:text-ink',
};

function Spinner(): ReactNode {
  return (
    <span
      aria-hidden="true"
      className="w-4 h-4 rounded-pill border-2 border-current border-t-transparent opacity-60 animate-spin"
    />
  );
}

// active 态: ink 反白 (跟 IconBtn.is-on 同套调性). 跟 variant 解耦, 通过 data-active
// hook 让任何 variant + active=true 都有视觉反馈. 不覆盖 disabled 优先级.
const ACTIVE_CLASS = 'bg-ink-1 text-paper-1 border-ink-1 hover:bg-ink-2 hover:border-ink-2';

export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading = false,
  fullWidth = false,
  active = false,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const isQuiet = variant === 'quiet';
  const base = isQuiet ? BASE_QUIET : BASE_SOLID;
  const sizeClass = isQuiet ? SIZE_QUIET[size] : SIZE[size];
  return (
    <button
      type={type}
      // `disabled || isLoading`（不是 `??`）：caller 显式传 disabled={false}
      // 时仍应允许 isLoading=true 阻止点击。
      disabled={disabled === true || isLoading}
      aria-busy={isLoading || undefined}
      aria-pressed={active || undefined}
      data-active={active || undefined}
      className={cn(
        base,
        sizeClass,
        VARIANT[variant],
        active && ACTIVE_CLASS,
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {isLoading ? <Spinner /> : leftIcon}
      {children != null ? <span>{children}</span> : null}
      {!isLoading && rightIcon ? rightIcon : null}
    </button>
  );
}
