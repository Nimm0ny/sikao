import type { IconProps } from './types';

/** Markdown bold control. */
export function FormatBoldIcon({ size = 18, className }: IconProps) {
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
      <path d="M8 5h5a3 3 0 0 1 0 6H8V5Z" />
      <path d="M8 11h6a3.5 3.5 0 0 1 0 7H8v-7Z" />
    </svg>
  );
}
