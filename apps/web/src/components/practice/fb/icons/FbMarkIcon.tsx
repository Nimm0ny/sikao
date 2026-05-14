import type { IconProps } from '@sikao/ui/icons/types';

// SIKAO Phase 3 (2026-05-09): 旗子 mark icon — 行测题"标记重做"语义.
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md.
// 1.4px stroke 跟 SIKAO icon 系统对齐 (CLAUDE.md §4 SVG-only).
//
// 不放 frontend/src/components/icons/ 主目录, 避免污染 icon library top-level.
// 这个 icon 仅 Fb* 系统内部用 (跟 PinIcon 不混淆).
export function FbMarkIcon({ size = 18, className }: IconProps) {
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
      <path d="M3 14V2.5" />
      <path d="M3 2.5h13l-2 4 2 4H3" />
    </svg>
  );
}
