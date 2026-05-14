import type { IconProps } from './types';

/** Markdown italic control. */
export function FormatItalicIcon({ size = 18, className }: IconProps) {
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
      <path d="M10 5h7" />
      <path d="M7 19h7" />
      <path d="M14 5 10 19" />
    </svg>
  );
}
