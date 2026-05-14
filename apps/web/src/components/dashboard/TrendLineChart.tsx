import type { TrendEntryV2 } from '@sikao/api-client/types/api';

// Phase 5.5 —— 14 天正确率折线图。手写 SVG polyline + 下方 area fill。
// 不用图表库（零依赖，符合 phase5-rebrand.md §Phase 5.5 图表决策）。
//
// Phase B (P1 #12) compact mode: Home 用 compact (高度 96px / 隐藏 grid /
// 隐藏 footer / 不显 legend). Dashboard 用默认 (160px + grid + footer).
// 视觉差异化避免 Home / Dashboard 同一张图重复出现.

const WIDTH = 620;
const HEIGHT_DEFAULT = 160;
const HEIGHT_COMPACT = 96;
const PADDING_X_DEFAULT = 24;
const PADDING_X_COMPACT = 12;
const PADDING_Y_DEFAULT = 20;
const PADDING_Y_COMPACT = 10;

function pointX(idx: number, total: number, paddingX: number): number {
  if (total <= 1) return WIDTH / 2;
  const usable = WIDTH - 2 * paddingX;
  return paddingX + (idx / (total - 1)) * usable;
}

function pointY(rate: number, height: number, paddingY: number): number {
  const clamped = Math.max(0, Math.min(1, rate));
  const usable = height - 2 * paddingY;
  return paddingY + (1 - clamped) * usable;
}

export interface TrendLineChartProps {
  readonly entries: readonly TrendEntryV2[];
  /** Compact 模式: Home 摘要用 (96px / 无 grid / 无 footer / 无 legend). */
  readonly compact?: boolean;
}

export function TrendLineChart({ entries, compact = false }: TrendLineChartProps) {
  const total = entries.length;
  if (total === 0) {
    return (
      <div className="border border-line bg-surface p-4 text-sm text-ink-3">
        暂无趋势数据。
      </div>
    );
  }

  const height = compact ? HEIGHT_COMPACT : HEIGHT_DEFAULT;
  const paddingX = compact ? PADDING_X_COMPACT : PADDING_X_DEFAULT;
  const paddingY = compact ? PADDING_Y_COMPACT : PADDING_Y_DEFAULT;
  const svgHeightClass = compact ? 'h-24' : 'h-40';

  const points = entries.map((e, idx) => ({
    x: pointX(idx, total, paddingX),
    y: pointY(e.rate, height, paddingY),
    date: e.date,
    rate: e.rate,
    count: e.total,
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const firstX = points[0].x;
  const lastX = points[total - 1].x;
  const bottomY = height - paddingY;
  // area fill 路径：polyline + 底线 + 回起点
  const areaPath =
    `M ${firstX},${bottomY} ` +
    points.map((p) => `L ${p.x},${p.y}`).join(' ') +
    ` L ${lastX},${bottomY} Z`;

  return (
    <section
      className={
        compact
          ? 'bg-surface border border-line p-3'
          : 'bg-surface border border-line p-4'
      }
      data-testid="trend-line-chart"
      data-compact={compact ? 'true' : 'false'}
      aria-label={compact ? '正确率趋势 (摘要)' : '近 14 天正确率趋势'}
    >
      {!compact ? (
        <header className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink">正确率趋势</h3>
          <span className="text-tiny font-mono text-ink-4 tracking-wide">
            近 {total} 天
          </span>
        </header>
      ) : null}
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className={`w-full ${svgHeightClass}`}
        preserveAspectRatio="none"
      >
        {/* grid lines at 0 / 50 / 100 — 仅 default 模式画 */}
        {!compact ? (
          <>
            <line
              x1={paddingX}
              x2={WIDTH - paddingX}
              y1={pointY(1, height, paddingY)}
              y2={pointY(1, height, paddingY)}
              stroke="var(--line-2)"
              strokeDasharray="2 3"
            />
            <line
              x1={paddingX}
              x2={WIDTH - paddingX}
              y1={pointY(0.5, height, paddingY)}
              y2={pointY(0.5, height, paddingY)}
              stroke="var(--line-2)"
              strokeDasharray="2 3"
            />
            <line
              x1={paddingX}
              x2={WIDTH - paddingX}
              y1={pointY(0, height, paddingY)}
              y2={pointY(0, height, paddingY)}
              stroke="var(--line-3)"
            />
          </>
        ) : null}

        {/* area */}
        <path d={areaPath} fill="var(--ink-1)" fillOpacity="0.08" />

        {/* polyline */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="var(--ink-1)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* markers */}
        {points.map((p) => (
          <g key={p.date}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.count > 0 ? 3 : 2}
              fill={p.count > 0 ? 'var(--ink-1)' : 'var(--line-3)'}
            />
            <title>
              {p.date} · {p.count} 题 · 正确率 {Math.round(p.rate * 100)}%
            </title>
          </g>
        ))}
      </svg>
      {!compact ? (
        <footer className="mt-1 flex justify-between text-tiny font-mono text-ink-4">
          <span>{entries[0].date}</span>
          <span>{entries[total - 1].date}</span>
        </footer>
      ) : null}
    </section>
  );
}
