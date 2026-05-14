import type { IconProps } from './types';

/** 排序 — 3 staggered bars. */
export function ToolSortIcon({ size = 18, className }: IconProps) {
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
      <path d="M5 7h14M7 12h10M9 17h6" />
    </svg>
  );
}
