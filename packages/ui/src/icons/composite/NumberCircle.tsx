import { useMemo } from 'react';
import {
  COMMON_STATUS_COLORS,
  COMPOSITE_SIZE_PX,
  compositeNumberFontSize,
  type CommonStatus,
  type CompositeSize,
} from './_shared';

// SIKAO 复合 icon — 题号圆.
//
// SSOT: design/SIKAO/icon-spec/composite-icons-spec.md §A (NumberCircle).
// 5 状态: unanswered / answered / marked / current / wrong. current=true 时
// 多渲染一圈 halo (r=11.5 / stroke 0.6 / opacity 0.3) — 仅 FbDock 用.
//
// 与普通 icon 不同: 内嵌 <text> 数字, viewBox 内坐标 hand-tuned (x=12 y=16
// for size=11, baseline 视觉中心). 每屏出现 35-40 次, 任何视觉漂移立刻被
// 发现, 因此颜色用 var(--*) token 而不是 currentColor (一次只能携带一通道).

export interface NumberCircleProps {
  readonly number: number | string;
  readonly status: CommonStatus;
  readonly size?: CompositeSize;
  readonly current?: boolean;
  readonly onClick?: () => void;
  readonly ariaLabel: string;
}

export function NumberCircle({
  number,
  status,
  size = 'sm',
  current = false,
  onClick,
  ariaLabel,
}: NumberCircleProps) {
  const px = COMPOSITE_SIZE_PX[size];
  const colors = COMMON_STATUS_COLORS[status];
  // 字号阶梯依赖 number 长度, useMemo 防 35 题列表里每次重渲染重算.
  const fontSize = useMemo(
    () => compositeNumberFontSize(number, px),
    [number, px],
  );

  const svg = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {colors.outerFill !== 'none' ? (
        <circle cx="12" cy="12" r="11" fill={colors.outerFill} />
      ) : null}
      {colors.outerStroke !== 'none' ? (
        <circle
          cx="12"
          cy="12"
          r="11"
          stroke={colors.outerStroke}
          strokeWidth="1.4"
          fill="none"
        />
      ) : null}
      {current ? (
        <circle
          cx="12"
          cy="12"
          r="11.5"
          stroke="var(--accent-1)"
          strokeWidth="0.6"
          strokeOpacity="0.3"
          fill="none"
        />
      ) : null}
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={fontSize}
        fill={colors.numberFill}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {number}
      </text>
    </svg>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        data-status={status}
        style={{
          width: px,
          height: px,
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {svg}
      </button>
    );
  }

  return (
    <span role="img" aria-label={ariaLabel} data-status={status}>
      {svg}
    </span>
  );
}
