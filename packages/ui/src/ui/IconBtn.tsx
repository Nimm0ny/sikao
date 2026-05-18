import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// SIKAO Phase 1' (2026-05-09): square icon button container.
//
// 设计 SSOT: `design/SIKAO/handoff/design/components.md` (.icon-btn anchor) +
// `design/SIKAO/extracted/component-className-map.md` (#IconBtn). Variants:
//   - default: 描边 rule + ink-3 icon, hover bg paper-2 / active bg paper-3
//   - on:      已选中态 (例: 收藏 / 标记). accent-50 bg + accent stroke
//   - primary: 主操作色 (accent bg + paper text). 一屏最多 1 处, 通常用 Button 替代
//
// **aria-label is required** (TS 强约束). 任何"图标按钮无文字"必须有可读 label,
// 否则 a11y 不通过. 这跟 SVG-only 行测/申论按钮的硬约束一致 (CLAUDE.md §4 §11
// 防屏阅读器读出空字符串).
//
// children 槽位是 SVG icon (后续 icon impl phase 提供 stroke 1.4 SVG primitive).
// 当前 placeholder 阶段允许 unicode (× / ⚙ / ☆ 等), 等 icon spec 出来 batch
// 替换. 不接受 emoji icon (CLAUDE.md §4 — 不允许 emoji 当 UI 图标).
//
// Dumb by contract (frontend/CLAUDE.md §2.2): 无 store / fetch / 路由副作用;
// onClick 由 caller 处理.

export type IconBtnSize = 'sm' | 'md';
export type IconBtnVariant = 'default' | 'on' | 'primary';

// `aria-label` 在 ButtonHTMLAttributes 已是 string | undefined; 这里 narrow 成
// required string 让调用方在 TS 阶段就拒掉 undefined. 必须 omit + 重新定义.
export interface IconBtnProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  readonly 'aria-label': string;
  readonly size?: IconBtnSize;
  readonly variant?: IconBtnVariant;
  readonly children?: ReactNode;
}

const SIZE: Record<IconBtnSize, string> = {
  // sm = 32px (默认 desktop) — SIKAO components.md 规定
  sm: 'w-8 h-8',
  // md = 40px (mobile / 触屏) — 无障碍触摸尺寸
  md: 'w-10 h-10',
};

// Variant 走 token. paper-2 / paper-3 通过 surface-alt + paper-deep alias 流向
// SIKAO paper 内核 (tokens.css 兼容层 §99-117).
const VARIANT: Record<IconBtnVariant, string> = {
  // 描边 rule + ink-3 icon (淡笔触感). hover 升 accent blue, active 沉 paper-3.
  default:
    'bg-transparent border border-line text-ink-3 ' +
    'hover:bg-accent-50 hover:text-accent hover:border-accent ' +
    'active:bg-paper-3',
  // 已选中态: accent-50 底 + accent stroke (e.g. 收藏后的星星 / 标记后的旗子)
  on: 'bg-accent-50 border border-accent text-accent',
  // 主操作: accent bg + paper text. 一屏最多 1 处 — 多了改用 Button primary.
  primary: 'bg-accent text-white border border-transparent hover:bg-accent-2',
};

const BASE =
  'inline-flex items-center justify-center shrink-0 rounded-tiny ' +
  'transition-[background-color,border-color,color] duration-fast ease-motion ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2';

export function IconBtn({
  size = 'sm',
  variant = 'default',
  type = 'button',
  className,
  children,
  ...rest
}: IconBtnProps) {
  return (
    <button
      type={type}
      className={cn(BASE, SIZE[size], VARIANT[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
