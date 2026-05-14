import type { IconProps } from './types';

/** 申论 — folded-doc + check + line. sidebar nav stroke 1.5. */
export function SubjectEssayIcon({ size = 18, className }: IconProps) {
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
      <path d="M5 3h11l3 3v15a1 1 0 0 1-1 1H5z" />
      <path d="M8 9l4 5 4-3M8 17h8" />
    </svg>
  );
}
