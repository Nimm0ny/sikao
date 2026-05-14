import type { IconProps } from './types';

/** Indeterminate loading spinner. */
export function LoaderIcon({ size = 18, className }: IconProps) {
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
      <path d="M12 3a9 9 0 0 1 9 9" />
      <path d="M21 12a9 9 0 0 1-9 9" opacity="0.25" />
      <path d="M12 21a9 9 0 0 1-9-9" opacity="0.25" />
      <path d="M3 12a9 9 0 0 1 9-9" opacity="0.25" />
    </svg>
  );
}
