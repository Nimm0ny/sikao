import type { IconProps } from './types';

/** Highlight annotation tool — marker nib. */
export function FormatHighlightIcon({ size = 18, className }: IconProps) {
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
      <path d="m4 17 6-6 3 3-6 6H4v-3Z" />
      <path d="m10 11 7-7 3 3-7 7" />
      <path d="M13 20h7" />
    </svg>
  );
}
