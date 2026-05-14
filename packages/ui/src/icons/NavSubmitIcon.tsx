import type { IconProps } from './types';

/**
 * 提交主 CTA 的 check 图标 — SVG-only 硬约束的唯一例外, 跟"提交"文字共存.
 * 仅在 Button.primary 内出现, 一屏 ≤1 处. SSOT: docs/design SVG-icon-system §6.2.
 */
export function NavSubmitIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12l5 5 13-13" />
    </svg>
  );
}
