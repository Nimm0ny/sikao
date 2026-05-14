import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.1 rebrand: Card gains `variant: 'default' | 'ink'` per
// element/preview/cards.html. Ink variant flips to ink bg + cream text, used in
// marketing pricing featured card, mobile hero, and "今日推荐" dark cards.
//
// Padding is exposed because element 稿 mixes p-5 / p-6 / p-8 across scopes;
// the component stays dumb by letting callers decide inner spacing.
//
// Brand v2「静读」PR1 (2026-05-08, design-system-v2-spec §6.2/§8.2):
//   - default variant: `border-line` → `border-transparent` + 默认加 `shadow-card`
//     极淡 (flomo 风减视觉密度, paper-on-paper 浮起感, 不再 border + shadow 双重边界).
//   - hoverable: `hover:border-line-3 + shadow-pop` → 仅 `shadow-pop` (border
//     保持 transparent, 视觉只升 elevation 不冒边).
//   - ink variant 不动 (marketing pricing 仍 ink 反色, ink 边在 ink 底视觉等价无 border).

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardVariant = 'default' | 'ink' | 'muted';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly as?: 'div' | 'article' | 'section' | 'aside';
  readonly padding?: CardPadding;
  readonly hoverable?: boolean;
  readonly variant?: CardVariant;
  readonly children?: ReactNode;
}

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 md:p-6',
  lg: 'p-6 md:p-8',
};

// Variant-aware base: ink 反色卡把 bg / text / border 一起翻（避免 caller 每处
// 手动覆盖 class）。ink-variant hoverable 效果用 border-ink 无 opacity 变化。
//
// Brand v2 PR1: default variant 默认加 `shadow-card` 极淡 + border-transparent
// 浮起 (替代 v1 border-line + 无 shadow 描边感). ink variant 不动. shadow 走
// token, dark mode 自动派生高 alpha (--shadow-card token 在 [data-theme=dark]
// override 阶段已定 0 1px 2px rgb(0 0 0 / 0.3) ...).
//
// SIKAO Phase 1' (2026-05-09): muted variant 新增. 设计 SSOT
// `design/SIKAO/handoff/design/components.md` (.comp-card tone=muted): 1px rule
// 描边 + paper-2 底, 无圆角默认 (走 rounded-card-lg token, lint pass). 用于
// "次要信息" 卡 (e.g. dashboard 右栏 AsideCard, profile 设置区分组).
const VARIANT: Record<CardVariant, string> = {
  default: 'bg-surface border-transparent text-ink shadow-card',
  ink: 'bg-ink border-ink text-white',
  muted: 'bg-surface-alt border-line text-ink',
};

const HOVERABLE_DEFAULT =
  'transition-[box-shadow] duration-base ease-motion hover:shadow-pop';
const HOVERABLE_INK =
  'transition-[box-shadow] duration-base ease-motion hover:shadow-pop';

export function Card({
  as: Tag = 'div',
  padding = 'md',
  hoverable = false,
  variant = 'default',
  className,
  children,
  ...rest
}: CardProps) {
  const hoverClass =
    hoverable ? (variant === 'ink' ? HOVERABLE_INK : HOVERABLE_DEFAULT) : '';
  return (
    <Tag
      className={cn(
        'border rounded-card-lg',
        VARIANT[variant],
        PADDING[padding],
        hoverClass,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
