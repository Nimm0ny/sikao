import type { IconProps } from './types';

// Frontend Style Guide v1 (PR3) — spinning loader icon.
//
// 规范 SSOT: docs/design/Frontend Style Guide.html §5 (icon library Loader entry).
// Stroke 1.6, fill: none, stroke-dasharray 56, stroke-dashoffset 14, animation: spin 1s linear.
//
// 实现选择: 用 Tailwind 内置 `animate-spin` (1s linear infinite rotate 0→360deg)
// 代替自定义 keyframes; spec stroke-dasharray + dashoffset 让圆环留 1/4 缺口
// 制造旋转视觉. currentColor + stroke + fill:none 跟其他 SIKAO icon (LoaderIcon /
// LoaderSvg) 风格一致.
//
// 跟 LoaderIcon (legacy SIKAO) 解耦:
//   - LoaderIcon = 4-arc 静态 (opacity 0.25 + 0.25 + 0.25 + 1) icon, 调用方手挂 animate-spin.
//   - IconLoader = 单 circle + dasharray gap 动态 spinner, 内建 animate-spin (一站式).
// 新代码用 IconLoader; LoaderIcon 现有引用保留向后兼容.

export function IconLoader({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className ?? ''}`.trim()}
      aria-hidden="true"
    >
      {/* dasharray 56 ~= 2π·9 (circumference), dashoffset 14 留 ~1/4 gap. */}
      <circle cx="12" cy="12" r="9" strokeDasharray="56" strokeDashoffset="14" />
    </svg>
  );
}
