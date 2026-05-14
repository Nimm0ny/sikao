import type { IconProps } from './types';

/** Link or cross-reference control. */
export function LinkIcon({ size = 18, className }: IconProps) {
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
      <path d="M10 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10.5a4 4 0 0 0-5.7 0L6 12.8a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </svg>
  );
}
