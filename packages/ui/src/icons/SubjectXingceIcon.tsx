import type { IconProps } from './types';

/** 行测 — folded-corner doc + 2 lines. sidebar nav stroke 1.5. */
export function SubjectXingceIcon({ size = 18, className }: IconProps) {
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
      <path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H4z" />
      <path d="M8 11h8M8 15h8" />
    </svg>
  );
}
