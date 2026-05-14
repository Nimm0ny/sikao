import type { IconProps } from './types';

/** Document with text lines. */
export function FileTextIcon({ size = 18, className }: IconProps) {
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
      <path d="M7 3.5h6l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M13 3.5v4h4" />
      <path d="M8.5 12h7" />
      <path d="M8.5 15.5h7" />
    </svg>
  );
}
