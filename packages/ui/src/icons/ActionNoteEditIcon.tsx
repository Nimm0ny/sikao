import type { IconProps } from './types';

/** 编辑笔记 (with-note state) — note + dot indicator. */
export function ActionNoteEditIcon({ size = 18, className }: IconProps) {
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
      <path d="M5 4h11l4 4v12H5z" />
      <path d="M8 10h9M8 13h9M8 16h6" />
      <circle cx="19" cy="6" r="2.5" fill="currentColor" />
    </svg>
  );
}
