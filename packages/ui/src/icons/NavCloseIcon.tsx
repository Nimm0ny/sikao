import type { IconProps } from './types';

/** 关闭 X — modal / drawer / dialog. */
export function NavCloseIcon({ size = 18, className }: IconProps) {
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
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}
