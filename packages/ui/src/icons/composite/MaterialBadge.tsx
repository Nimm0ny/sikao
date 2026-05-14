import { cn } from '@sikao/shared-utils';

// SIKAO 复合 icon — 申论材料编号 M1 ... M9 (MaterialBadge).
//
// SSOT: design/SIKAO/icon-spec/composite-icons-spec.md §C.
// 渲染策略: HTML <button> + 1 inline SVG (仅 marked 状态 dot). 不是单 SVG —
// 因为 MmStrip cell 走 grid-template-columns: repeat(7, 1fr) 动态宽度, SVG
// viewBox 拉伸 + <text> 跨浏览器 placement 太脆.
//
// 4 状态: pending / read / marked / active. CSS 通过 data-status 切换 class.
// active 状态 ::after 加 underline 2px accent 作"当前阅读"视觉锚点.
//
// 样式 .mat-badge / [data-status=...] 在 mat-badge.css 内 (sibling import).

import './mat-badge.css';

export type MaterialStatus = 'pending' | 'read' | 'marked' | 'active';

export interface MaterialBadgeProps {
  readonly index: number;
  readonly status: MaterialStatus;
  readonly count?: number;
  readonly active?: boolean;
  readonly onClick?: () => void;
  readonly ariaLabel: string;
  readonly className?: string;
}

export function MaterialBadge({
  index,
  status,
  onClick,
  ariaLabel,
  className,
}: MaterialBadgeProps) {
  const slots = Array.from({ length: Math.min(4, Math.max(1, index)) }, (_, i) => i);
  return (
    <button
      type="button"
      className={cn('mat-badge', className)}
      data-status={status}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 32 20"
        width="32"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="20" height="12" rx="2" />
        <path d="M8 8h12M8 12h8" />
        {slots.map((slot) => (
          <circle
            key={slot}
            cx={28}
            cy={5 + slot * 3.2}
            r="0.9"
            fill="currentColor"
            stroke="none"
          />
        ))}
        {status === 'marked' ? (
          <circle cx="23" cy="5" r="2.4" fill="var(--accent-1)" stroke="none" />
        ) : null}
      </svg>
    </button>
  );
}
