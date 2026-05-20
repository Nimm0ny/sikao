import type { KnowledgeCategory, KnowledgePointEntryV2 } from '@sikao/api-client/types/api';
import { EmptyState } from '@sikao/ui/ui';
import { DASHBOARD_COPY } from '@/lib/ui-copy';

// Phase 5.5 —— 知识点气泡图。纯 SVG + 2 行 5 列网格 + 气泡半径映射 total。
// 颜色按 category（strong=success / ok=warn / weak=danger）。
// 本阶段不引 d3-force，简单网格 + ±10% 抖动足够；plan §3.5 标明后续可换。

const WIDTH = 720;
const HEIGHT = 260;
const MIN_R = 18;
const MAX_R = 46;
const COLS = 5;
const ROWS = 2;

const CATEGORY_FILL: Record<KnowledgeCategory, string> = {
  strong: 'var(--ok)',
  ok: 'var(--warn)',
  weak: 'var(--err)',
};

function bubbleRadius(total: number, minTotal: number, maxTotal: number): number {
  if (maxTotal <= minTotal) return (MIN_R + MAX_R) / 2;
  const ratio = (total - minTotal) / (maxTotal - minTotal);
  return MIN_R + Math.max(0, Math.min(1, ratio)) * (MAX_R - MIN_R);
}

// 稳定抖动：基于 index 做确定性偏移（避免 React rerender 震荡）。
function jitterOffset(idx: number, seed: number): number {
  const v = Math.sin(idx * 9301 + seed * 49297) * 0.5;
  return v; // -0.5 .. 0.5
}

export interface KnowledgeBubbleChartProps {
  readonly points: readonly KnowledgePointEntryV2[];
}

export function KnowledgeBubbleChart({ points }: KnowledgeBubbleChartProps) {
  if (points.length === 0) {
    return (
      <EmptyState
        title={DASHBOARD_COPY.knowledgeBubbleEmpty}
        description={`${DASHBOARD_COPY.knowledgeBubbleEmptyHint}。`}
      />
    );
  }

  // 取最多 COLS × ROWS 个，总量降序（后端已排，保险再取一次）。
  const visible = [...points].slice(0, COLS * ROWS);
  const totals = visible.map((p) => p.total);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);

  const cellW = WIDTH / COLS;
  const cellH = HEIGHT / ROWS;

  return (
    <section
      className="bg-surface border border-line p-4"
      data-testid="knowledge-bubble-chart"
      aria-label={DASHBOARD_COPY.knowledgeBubbleTitle}
    >
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-ink">{DASHBOARD_COPY.knowledgeBubbleHeader}</h3>
        <span className="text-tiny font-mono text-ink-4 tracking-wide">
          {visible.length} / {points.length} 项
        </span>
      </header>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-[260px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {visible.map((p, idx) => {
          const col = idx % COLS;
          const row = Math.floor(idx / COLS);
          const baseX = cellW * col + cellW / 2;
          const baseY = cellH * row + cellH / 2;
          const cx = baseX + jitterOffset(idx, 1) * cellW * 0.15;
          const cy = baseY + jitterOffset(idx, 2) * cellH * 0.15;
          const r = bubbleRadius(p.total, minTotal, maxTotal);
          return (
            <g key={p.name}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={CATEGORY_FILL[p.category]}
                fillOpacity={0.7}
              >
                <title>
                  {p.name} · {p.correct}/{p.total} · {Math.round(p.rate * 100)}%
                </title>
              </circle>
              <text
                x={cx}
                y={cy + r + 16}
                textAnchor="middle"
                className="fill-ink font-medium"
                fontSize="12"
              >
                {p.name}
              </text>
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                className="fill-white font-serif italic"
                fontSize="15"
              >
                {Math.round(p.rate * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
      <footer className="mt-2 flex items-center gap-4 text-tiny text-ink-3">
        <span className="inline-flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-pill bg-ok" /> 强（≥80%）
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-pill bg-warn" /> 一般（60-80%）
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-pill bg-err" /> 弱（&lt;60%）
        </span>
      </footer>
    </section>
  );
}
