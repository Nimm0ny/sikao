import type { IconProps } from './types';

/** 添加笔记 — folded-corner doc + 三横线 (FbCard 操作条). */
export function ActionNoteIcon({ size = 18, className }: IconProps) {
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
    </svg>
  );
}
