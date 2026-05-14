import type { IconProps } from './types';

/** 笔记编辑（pencil overlapping note）— "记一笔" 入口。 */
export function NoteEditIcon({ size = 18, className }: IconProps) {
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
      <path d="M5 4h8v6h6v10H5z" />
      <path d="M13 4l6 6" />
      <path d="M14 16l3-3 2 2-3 3z" />
    </svg>
  );
}
