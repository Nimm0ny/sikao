import { Card } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import type { HeatmapEntryV2 } from '@sikao/api-client/types/api';

// Phase 5.5 —— GitHub 风格 53 周 × 7 天热力图。零依赖 div grid。
// 数据约 371 条（后端保证补零），按 date.getDay() 落到 Sun-Sat 7 行。
//
// 色档：count=0 surface-alt / ≤5 brand-100 / ≤10 brand-200 / ≤20 ink-muted
// opacity / >20 ink。brand = ink，阶梯用 brand-{50,100,200}。

const WEEKDAY_LABELS = ['一', '三', '五'] as const; // 只标 Mon/Wed/Fri 避免密集

function cellToneClass(count: number): string {
  if (count === 0) return 'bg-surface-alt border-line';
  if (count <= 5) return 'bg-paper-3 border-line-3';
  if (count <= 10) return 'bg-line-3 border-line-3';
  if (count <= 20) return 'bg-ink-3 border-ink-3';
  return 'bg-ink border-ink';
}

function hasPracticeData(entries: readonly HeatmapEntryV2[]): boolean {
  return entries.some((entry) => entry.count > 0);
}

export interface HeatmapChartProps {
  readonly entries: readonly HeatmapEntryV2[];
}

// 将 entries 重排成 7 行 × N 周网格。row=weekday (Sun=0..Sat=6, 本地 Mon 起始调整 → 0=Mon)。
function buildGrid(entries: readonly HeatmapEntryV2[]): (HeatmapEntryV2 | null)[][] {
  if (entries.length === 0) return [];
  // 把第一条 date 对齐到本周周一作为起始。
  const first = new Date(entries[0].date);
  const mondayOffset = (first.getDay() + 6) % 7; // Mon=0..Sun=6
  const rows: (HeatmapEntryV2 | null)[][] = Array.from({ length: 7 }, () => []);
  const totalCells = entries.length + mondayOffset;
  const weeks = Math.ceil(totalCells / 7);
  for (let col = 0; col < weeks; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const idx = col * 7 + row - mondayOffset;
      rows[row].push(idx >= 0 && idx < entries.length ? entries[idx] : null);
    }
  }
  return rows;
}

export function HeatmapChart({ entries }: HeatmapChartProps) {
  if (!hasPracticeData(entries)) {
    return (
      <Card
        as="section"
        padding="sm"
        className="text-sm text-ink-3"
        data-testid="heatmap-chart-empty"
        aria-label="练习热力图"
      >
        <header className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-ink">练习热力图</h3>
          <span className="text-tiny font-mono text-ink-4 tracking-wide">
            近 53 周
          </span>
        </header>
        <p>暂无练习记录, 答过题后热力图会出现在这里。</p>
      </Card>
    );
  }
  const grid = buildGrid(entries);
  if (grid.length === 0) {
    return (
      <div className="border border-line rounded-card bg-surface p-4 text-sm text-ink-3">
        暂无数据 — 答过题后热力图会出现在这里。
      </div>
    );
  }
  return (
    <section
      className="bg-surface border border-line rounded-card p-4 overflow-x-auto"
      data-testid="heatmap-chart"
      aria-label="练习热力图"
    >
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-ink">练习热力图</h3>
        <span className="text-tiny font-mono text-ink-4 tracking-wide">
          近 53 周
        </span>
      </header>
      <div className="flex gap-1">
        {/* weekday labels */}
        <div className="flex flex-col justify-between text-tiny text-ink-4 py-1 shrink-0 w-3">
          <span>&nbsp;</span>
          <span>{WEEKDAY_LABELS[0]}</span>
          <span>&nbsp;</span>
          <span>{WEEKDAY_LABELS[1]}</span>
          <span>&nbsp;</span>
          <span>{WEEKDAY_LABELS[2]}</span>
          <span>&nbsp;</span>
        </div>
        {/* grid */}
        <div className="flex flex-col gap-1">
          {grid.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1">
              {row.map((cell, colIdx) => {
                if (cell === null) {
                  return <span key={colIdx} className="w-3 h-3 shrink-0" />;
                }
                return (
                  <span
                    key={colIdx}
                    aria-label={`${cell.date} · ${cell.count} 题 · 正确率 ${Math.round(cell.rate * 100)}%`}
                    className={cn(
                      'w-3 h-3 border rounded-1 shrink-0',
                      cellToneClass(cell.count),
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <footer className="mt-3 flex items-center gap-2 text-tiny text-ink-4">
        <span>少</span>
        <span className="w-3 h-3 rounded-1 bg-surface-alt border border-line inline-block" />
        <span className="w-3 h-3 rounded-1 bg-paper-3 border border-line-3 inline-block" />
        <span className="w-3 h-3 rounded-1 bg-line-3 border border-line-3 inline-block" />
        <span className="w-3 h-3 rounded-1 bg-ink-3 border border-ink-3 inline-block" />
        <span className="w-3 h-3 rounded-1 bg-ink border border-ink inline-block" />
        <span>多</span>
      </footer>
    </section>
  );
}
