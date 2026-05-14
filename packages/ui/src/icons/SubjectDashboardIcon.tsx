import type { IconProps } from './types';

/** 数据 — vertical bars. sidebar nav stroke 1.5. */
export function SubjectDashboardIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 19V8M10 19V4M16 19v-7M22 19H2" />
    </svg>
  );
}
