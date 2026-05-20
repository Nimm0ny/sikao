import { cn } from '@sikao/shared-utils';
import type { EssayDimensionV2 } from '@sikao/api-client/types/api';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';

// Slice 2d — 申论 5 维度雷达图 (dumb, props-only).
//
// 用纯 SVG 不引 chart.js / recharts (省 ~80kb gzip). 5 维顺序由 props 决定,
// 调用方按 backend prompt builder 给的顺序传 (论点 / 材料 / 语言 / 结构 /
// 字数), 组件本身不假定顺序也不重排.
//
// 视觉: ink stroke + accent fill (透明), 跟 ScoreRing 的 ink-first
// 调性对齐. 同心 5 圈作 grid (每圈 score=2 step), 单一 accent fill 是允许的
// "1 处关键 CTA / 信息高亮", 见 docs/design/style-guide.md §1 90/8/2.

const SCORE_MAX = 10;
const VIEW_BOX = 240;
const CENTER = VIEW_BOX / 2;
const CHART_RADIUS = 90; // 留出 30px 给标签

interface Point {
  readonly x: number;
  readonly y: number;
}

// 维度 i 对应角度: 12 点钟方向起, 顺时针 72° 一格. 0°=top, 跟 ScoreRing
// (-rotate-90) 视觉一致. SVG 坐标系 y 轴向下, 用 -cos.
function angleAt(index: number, count: number): number {
  return (index / count) * Math.PI * 2;
}

function pointAt(index: number, count: number, ratio: number): Point {
  const angle = angleAt(index, count);
  const r = CHART_RADIUS * ratio;
  return {
    x: CENTER + Math.sin(angle) * r,
    y: CENTER - Math.cos(angle) * r,
  };
}

function clampScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  if (score >= SCORE_MAX) return SCORE_MAX;
  return score;
}

export interface EssayDimensionsRadarProps {
  readonly dimensions: readonly EssayDimensionV2[];
  readonly className?: string;
}

export function EssayDimensionsRadar({
  dimensions,
  className,
}: EssayDimensionsRadarProps) {
  const count = dimensions.length;

  // 0/1 维度无意义 (R10 sanity 已 raise on backend), 但 dumb 组件防御性显示空.
  // 早返避免 NaN polygon (count=0 → angle 除 0).
  if (count < 3) {
    return (
      <div
        className={cn(
          'aspect-square w-full max-w-xs flex items-center justify-center text-ink-3 text-sm',
          className,
        )}
        data-testid="essay-radar-empty"
      >
        —
      </div>
    );
  }

  // 5 维 sin/cos 计算每帧 < 1µs, 不上 useMemo (避免依赖 array 引用比较的认知开销).
  const polygonPoints = dimensions
    .map((d, i) => {
      const ratio = clampScore(d.score) / SCORE_MAX;
      const p = pointAt(i, count, ratio);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(' ');

  // 5 圈 grid: ratio 0.2 / 0.4 / 0.6 / 0.8 / 1.0
  const gridRings = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className={cn('relative w-full max-w-xs', className)} data-testid="essay-radar">
      <svg
        viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
        className="w-full h-auto"
        role="img"
        aria-label={`申论 5 ${ESSAY_SIKAO_COPY.radarAriaLabel}`}
      >
        {/* grid rings */}
        {gridRings.map((ratio) => (
          <polygon
            key={ratio}
            points={Array.from({ length: count }, (_, i) => {
              const p = pointAt(i, count, ratio);
              return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
            }).join(' ')}
            stroke="var(--line-2)"
            strokeWidth={1}
            fill="none"
            strokeDasharray={ratio === 1 ? 'none' : '2 3'}
          />
        ))}
        {/* axis spokes */}
        {dimensions.map((_, i) => {
          const p = pointAt(i, count, 1);
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={p.x}
              y2={p.y}
              stroke="var(--line-2)"
              strokeWidth={1}
            />
          );
        })}
        {/* data polygon */}
        <polygon
          points={polygonPoints}
          stroke="var(--ink-1)"
          strokeWidth={1.5}
          fill="var(--accent-1)"
          fillOpacity={0.12}
          data-testid="essay-radar-polygon"
        />
        {/* data points */}
        {dimensions.map((d, i) => {
          const ratio = clampScore(d.score) / SCORE_MAX;
          const p = pointAt(i, count, ratio);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              fill="var(--ink-1)"
              data-testid={`essay-radar-point-${i}`}
            />
          );
        })}
        {/* labels */}
        {dimensions.map((d, i) => {
          const labelP = pointAt(i, count, 1.18);
          // text-anchor 跟角度匹配, 防左侧标签被切
          const angle = angleAt(i, count);
          const sin = Math.sin(angle);
          const anchor =
            Math.abs(sin) < 0.1 ? 'middle' : sin > 0 ? 'start' : 'end';
          return (
            <text
              key={i}
              x={labelP.x}
              y={labelP.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--ink-3)"
              data-testid={`essay-radar-label-${i}`}
            >
              {d.name}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
