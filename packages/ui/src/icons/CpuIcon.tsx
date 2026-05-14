import type { IconProps } from './types';

export function CpuIcon({ size = 18, className }: IconProps) {
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
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M10 11h4" />
      <path d="M10 14h4" />
      <path d="M4 9h3" />
      <path d="M4 15h3" />
      <path d="M17 9h3" />
      <path d="M17 15h3" />
      <path d="M9 4v3" />
      <path d="M15 4v3" />
      <path d="M9 17v3" />
      <path d="M15 17v3" />
    </svg>
  );
}
