import { cn } from '@sikao/shared-utils';
import type { Material } from '@sikao/domain/shenlun/types';

interface Props {
  materials: readonly Material[];
  matIdx: number;
  matchCounts: readonly number[];
  highlightCounts: readonly number[];
  onSelect: (i: number) => void;
}

const PREVIEW_LEN = 80;

// MaterialOverview — 2×2 card grid. Each card shows title / subtitle /
// first-N-char preview / 字数 / 划线 count / 命中 count. Click enters that
// material's reading mode (parent flips overview off + sets matIdx).

export function MaterialOverview({
  materials,
  matIdx,
  matchCounts,
  highlightCounts,
  onSelect,
}: Props) {
  return (
    <div className="pt-3" data-testid="exam-materials-overview">
      <div className="text-xs text-ink-3 mb-3 font-medium">
        共 {materials.length} 篇资料 · 点击进入阅读
      </div>
      <div className="grid grid-cols-2 gap-3">
        {materials.map((mat, i) => {
          const hits = matchCounts[i] ?? 0;
          const hlCount = highlightCounts[i] ?? 0;
          const isActive = i === matIdx;
          const preview = mat.body.slice(0, PREVIEW_LEN);
          return (
            <button
              type="button"
              key={mat.id}
              onClick={() => onSelect(i)}
              className={cn(
                'text-left p-3 bg-surface rounded-card-lg border cursor-pointer',
                'flex flex-col gap-2 relative font-sans transition-all duration-base',
                'hover:shadow-card hover:-translate-y-px',
                isActive ? 'border-ink' : 'border-line',
              )}
              style={{ minHeight: 130 }} /* hardcode-allow: 130px overview card min-height ensures the 3-line preview clamp doesn't collapse */
              data-testid={`exam-materials-overview-card-${i}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-ink">{mat.title}</span>
                {isActive && <span className="text-tiny text-accent font-semibold">· 当前</span>}
              </div>
              <div className="text-xs text-ink-3 font-medium leading-snug">{mat.subtitle}</div>
              <div
                className="text-xs text-ink-4 font-serif flex-1 overflow-hidden"
                style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: 1.55 }}
              >
                {preview}…
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-surface-alt">
                <span className="text-tiny text-ink-4 font-mono tabular-nums">
                  {mat.body.length} 字
                </span>
                {hlCount > 0 && (
                  <span className="text-tiny text-accent font-semibold inline-flex items-center gap-1">
                    <span className="w-1 h-1 rounded-pill bg-accent" /* hardcode-allow: 4px badge dot, sub-token */ aria-hidden />
                    划线 {hlCount}
                  </span>
                )}
                {hits > 0 && (
                  <span className="text-tiny text-warn font-semibold px-2 py-px bg-warn-bg rounded-pill">
                    命中 {hits}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
