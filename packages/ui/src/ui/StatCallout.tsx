import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.2 primitive — editorial stat callout with big serif number.
// 参考 element/preview/cards.html 的 `.stat` 卡 +
// element/preview/progress.html 的 `.num-big`。
//
// 视觉：
//   - hairline outline box（可选，via `hairline` prop）
//   - label: mono uppercase eyebrow
//   - value: serif italic 400 + 大字号 + tabular-nums
//   - unit: mono 小字（%）/ supSerif 中号字（百分号）
//   - delta: optional，如 "比昨天高 4 个百分点"
//   - trend: optional，右下角 7 天 mini sparkline (SIKAO Phase 1D, spec
//     `design/SIKAO/handoff/specs/01-dashboard.md` 行 14/24)
//
// 两种大小：
//   - md（默认）：value ~44px（对应 preview `.num-big`）
//   - lg：value ~56px（对应 preview `.stat .n`）

export interface StatCalloutProps extends HTMLAttributes<HTMLDivElement> {
  readonly label: ReactNode;
  readonly value: ReactNode;
  /** 单位符号，如 "%" / "题"。渲染为 sup 小字。 */
  readonly unit?: ReactNode;
  /** 右侧补充信息（如 "+ 56 本周"）。 */
  readonly trailing?: ReactNode;
  /** 下方描述行。 */
  readonly description?: ReactNode;
  readonly size?: 'md' | 'lg';
  /** true 时渲染 hairline box；false 时透出父容器背景（用于内嵌）。 */
  readonly hairline?: boolean;
  /**
   * SIKAO Phase 1D: 7 天 mini sparkline 数据 (任意范围数字数组). 提供时
   * 在卡片右下渲染 inline SVG polyline. 长度 < 2 自动跳过 (单点不算 trend);
   * 全相同 / 全 0 降级为水平直线 (避免除零). 装饰性 (aria-hidden).
   */
  readonly trend?: readonly number[];
}

const VALUE_SIZE: Record<NonNullable<StatCalloutProps['size']>, string> = {
  md: 'text-5xl',
  lg: 'text-display',
};

// Sparkline 几何常量 (SVG viewport).
const SPARK_WIDTH = 60;
const SPARK_HEIGHT = 16;

function buildSparkPoints(trend: readonly number[]): string {
  // 长度 < 2 调用方已 filter, 这里保险.
  if (trend.length < 2) return '';
  const max = Math.max(...trend);
  const min = Math.min(...trend);
  const range = max - min;
  // 全相同 (含全 0): 水平直线 y = SPARK_HEIGHT / 2.
  if (range === 0) {
    return trend
      .map((_, i) => {
        const x = (i / (trend.length - 1)) * SPARK_WIDTH;
        return `${x.toFixed(2)},${(SPARK_HEIGHT / 2).toFixed(2)}`;
      })
      .join(' ');
  }
  return trend
    .map((v, i) => {
      const x = (i / (trend.length - 1)) * SPARK_WIDTH;
      // y 反转 (SVG 原点左上, 高值在上).
      const y = ((max - v) / range) * SPARK_HEIGHT;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function StatCallout({
  label,
  value,
  unit,
  trailing,
  description,
  size = 'md',
  hairline = true,
  trend,
  className,
  ...rest
}: StatCalloutProps) {
  const showSparkline = trend !== undefined && trend.length >= 2;
  const sparkPoints = showSparkline ? buildSparkPoints(trend) : '';
  return (
    <div
      className={cn(
        'relative flex flex-col gap-2',
        hairline && 'bg-surface border border-line px-6 py-5',
        className,
      )}
      {...rest}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-tiny font-semibold tracking-widest uppercase text-ink-4">
          {label}
        </span>
        {trailing != null ? <span className="text-sm text-ink-3">{trailing}</span> : null}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            'font-serif italic font-normal tabular-nums text-ink-3 leading-none tracking-tight',
            VALUE_SIZE[size],
          )}
        >
          {value}
        </span>
        {unit != null ? (
          <sup className="font-serif not-italic text-lg text-ink-3 font-normal">{unit}</sup>
        ) : null}
      </div>
      {description != null ? (
        <p className="text-xs text-ink-3 leading-normal">{description}</p>
      ) : null}
      {showSparkline ? (
        <svg
          aria-hidden="true"
          data-testid="stat-callout-sparkline"
          viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
          width={SPARK_WIDTH}
          height={SPARK_HEIGHT}
          className="absolute bottom-2 right-3 text-ink-3 opacity-40"
          preserveAspectRatio="none"
        >
          <polyline
            points={sparkPoints}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );
}
