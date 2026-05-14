import type { IconProps } from './types';

/** 草稿纸 toggle — 申论 toolbar. notebook 三横线. */
export function ToolScratchIcon({ size = 18, className }: IconProps) {
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
      <rect x="4" y="3" width="16" height="18" />
      <path d="M4 8h16M4 13h16M4 18h16" />
    </svg>
  );
}
