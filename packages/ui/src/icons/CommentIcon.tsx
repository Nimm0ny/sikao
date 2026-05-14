import type { IconProps } from './types';

/** 评论气泡 — hairline 描边. 跟 ChatIcon 区别: ChatIcon 是 1 chat panel 入口,
 *  CommentIcon 是 list item action (点赞 / 评论 / 收藏 之一). */
export function CommentIcon({ size = 18, className }: IconProps) {
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
      <path d="M4 5h16v11H8l-4 4z" />
      <path d="M8 9h8" />
      <path d="M8 12h5" />
    </svg>
  );
}
