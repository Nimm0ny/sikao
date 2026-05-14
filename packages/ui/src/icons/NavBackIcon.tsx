import type { IconProps } from './types';

/** 返回学习中心 — arrow-left with leading bar. */
export function NavBackIcon({ size = 18, className }: IconProps) {
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
      <path d="M20 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}
