import type { IconProps } from './types';

/** Markdown list control. */
export function FormatListIcon({ size = 18, className }: IconProps) {
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
      <path d="M9 7h10" />
      <path d="M9 12h10" />
      <path d="M9 17h10" />
      <path d="M5 7h.01" />
      <path d="M5 12h.01" />
      <path d="M5 17h.01" />
    </svg>
  );
}
