import type { IconProps } from './types';

/** 错题本 — bookmark + X. sidebar nav stroke 1.5. */
export function SubjectWrongbookIcon({ size = 18, className }: IconProps) {
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
      <path d="M5 3v18l7-4 7 4V3z" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}
