import type { IconProps } from './types';

export function MailIcon({ size = 18, className }: IconProps) {
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
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M5 8l7 5 7-5" />
    </svg>
  );
}
