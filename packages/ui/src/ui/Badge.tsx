import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.1 rebrand: Badge gains `variant: 'chip' | 'hairline'` per
// element/preview/badges.html.
//   - chip (default): 现有 tinted chip（brand/neutral/success/warn/danger）
//   - hairline: 高度 30px 的 outline 小盒，可嵌 serif italic 数字，
//     如 `<Badge variant='hairline' tone='success'>答对 <span className="font-serif italic">+8</span></Badge>`。

export type BadgeTone = 'brand' | 'neutral' | 'success' | 'warn' | 'danger' | 'accent';
export type BadgeVariant = 'chip' | 'hairline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: BadgeTone;
  readonly dot?: boolean;
  readonly variant?: BadgeVariant;
  /**
   * SIKAO Phase 1' (2026-05-09): active 态 (例: 行测题号 chip 当前 / 错题
   * filter 选中). active=true 时反衬 ink 黑底白字. 跟 SIKAO components.md
   * `.chip.is-accent` / `.chip.is-active` anchor 一致.
   */
  readonly active?: boolean;
  readonly children?: ReactNode;
}

const CHIP_TONE: Record<BadgeTone, string> = {
  // element app/index.html §50, 75: brand chip 是灰底黑字
  // (brand-50 bg + brand-100 border + brand-700 ~ink text)。蓝色专属 accent CTA，
  // 不进 chip。需要蓝色 chip 的场景改用 hairline variant + dot。
  brand: 'bg-paper-2 border-paper-3 text-ink-1',
  neutral: 'bg-surface-alt border-line text-ink-3',
  success: 'bg-ok-bg border-ok text-ok',
  warn: 'bg-warn-bg border-warn text-warn',
  danger: 'bg-bad-bg border-err text-err',
  // SIKAO Phase 1': accent (暗朱) chip — 一屏最多 1 处, 例: 当前题/激活 filter.
  accent: 'bg-accent-50 border-accent text-accent',
};

// Hairline 变体：边 + 字同色，无背景底。tone=neutral 时用 muted 灰。
const HAIRLINE_TONE: Record<BadgeTone, string> = {
  brand: 'border-ink text-ink',
  neutral: 'border-line-3 text-ink-3',
  success: 'border-ok text-ok',
  warn: 'border-warn text-warn',
  danger: 'border-err text-err',
  accent: 'border-accent text-accent',
};

const DOT: Record<BadgeTone, string> = {
  brand: 'bg-ink',
  neutral: 'bg-ink-3',
  success: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-err',
  accent: 'bg-accent',
};

// active 态: 反衬 ink 黑底白字, override tone bg/border/text. SIKAO components
// .md anchor `.chip.is-accent` (题号当前) / WrongBook filter 选中.
const ACTIVE_CHIP = 'bg-ink border-ink text-white';
const ACTIVE_HAIRLINE = 'bg-ink border-ink text-white';

const CHIP_BASE =
  'inline-flex items-center gap-2 px-2 py-1 rounded-tiny text-tiny font-semibold border';

// Hairline 用元素 height 30px（element spec）+ 稍大 font-size + 更大 padding。
const HAIRLINE_BASE =
  'inline-flex items-center gap-2 h-[30px] px-3 rounded-none text-sm font-medium border bg-transparent';

export function Badge({
  tone = 'neutral',
  dot = false,
  variant = 'chip',
  active = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  const isHairline = variant === 'hairline';
  // active 态优先 (覆盖 tone): 反衬 ink 黑底白字让选中态够强.
  const toneCls = active
    ? (isHairline ? ACTIVE_HAIRLINE : ACTIVE_CHIP)
    : (isHairline ? HAIRLINE_TONE[tone] : CHIP_TONE[tone]);
  // active 态 dot 改白 (反衬 ink 底), 否则跟 tone 走.
  const dotColorCls = active ? 'bg-white' : DOT[tone];
  return (
    <span
      className={cn(
        isHairline ? HAIRLINE_BASE : CHIP_BASE,
        toneCls,
        className,
      )}
      data-active={active || undefined}
      {...rest}
    >
      {dot ? (
        <span
          aria-hidden="true"
          data-pattern="dot"
          className={cn(
            'rounded-pill',
            isHairline ? 'w-[7px] h-[7px]' : 'w-1.5 h-1.5', // hardcode-allow: hairline 7×7px sub-token, design SSOT 微调不在阶梯
            dotColorCls,
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
