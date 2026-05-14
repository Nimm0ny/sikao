import type { IconProps } from './types';

/** 标记 — flag 形 (FbCard / FbDock). */
export function ActionMarkIcon({ size = 18, className }: IconProps) {
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
      <path d="M5 21V3h12l-2.5 4 2.5 4H5" />
    </svg>
  );
}
