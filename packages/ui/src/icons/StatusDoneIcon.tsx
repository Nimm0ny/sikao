import type { IconProps } from './types';

/** 已完成 — check. ok 色由调用方 className `text-ok` 设. */
export function StatusDoneIcon({ size = 18, className }: IconProps) {
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
      <path d="M3 12l5 5 13-13" />
    </svg>
  );
}
