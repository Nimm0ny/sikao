import { useMemo } from 'react';
import { PenIcon, XCloseIcon } from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import type { Highlight, Material } from '@sikao/domain/shenlun/types';

interface RailItem {
  key: string;
  matTitle: string;
  text: string;
  matId: string;
  idx: number;
}

interface RailGroup {
  mat: Material;
  items: RailItem[];
}

interface Props {
  materials: readonly Material[];
  highlights: Record<string, Highlight[]>;
  onSendToScratch: (line: string) => void;
  onCollectAll: () => void;
  onRemove: (matId: string, idx: number) => void;
}

// HighlightRail — 220px right-edge column visible in wide mode. Surfaces
// every saved highlight grouped by material with drag-to-scratch + double-
// click-to-send + × delete affordances.

export function HighlightRail({
  materials,
  highlights,
  onSendToScratch,
  onCollectAll,
  onRemove,
}: Props) {
  // Single-pass groupBy. The previous implementation flat-mapped all items
  // and then `.filter(matIdx === mi)` per material — quadratic in highlight
  // count. Now we walk materials once, build per-material lists, and skip
  // empty groups.
  const { groups, total } = useMemo(() => {
    const out: RailGroup[] = [];
    let count = 0;
    for (const mat of materials) {
      const list = highlights[mat.id] ?? [];
      if (list.length === 0) continue;
      const items: RailItem[] = list.map((r, j) => ({
        key: `${mat.id}-${j}`,
        matTitle: mat.title,
        text: mat.body.slice(r.start, r.end),
        matId: mat.id,
        idx: j,
      }));
      count += items.length;
      out.push({ mat, items });
    }
    return { groups: out, total: count };
  }, [materials, highlights]);

  const empty = total === 0;

  return (
    <div
      className="w-[220px] shrink-0 h-full flex flex-col bg-[var(--exam-paper)] border-l border-line" /* hardcode-allow: 220px rail width is design v2 spec */
      data-testid="exam-highlight-rail"
    >
      <div className="px-3 pt-3 pb-2 shrink-0 border-b border-line">
        <div className="flex items-center justify-between mb-2">
          <div className="text-tiny font-bold text-ink tracking-widest">划线汇总</div>
          <span className="text-tiny text-ink-4 font-mono">{total}</span>
        </div>
        <button
          type="button"
          onClick={onCollectAll}
          disabled={empty}
          aria-label="整理划线到草稿"
          className={cn(
            'w-full px-2 py-2 rounded-tiny border',
            'text-tiny font-semibold inline-flex items-center justify-center gap-1',
            empty
              ? 'border-line bg-surface-alt text-ink-4 cursor-not-allowed'
              : 'border-ink bg-ink text-surface cursor-pointer',
          )}
          data-testid="exam-highlight-rail-collect-btn"
        >
          <PenIcon className="w-3 h-3" />
        </button>
        <div className="text-tiny text-ink-4 mt-2 leading-relaxed">
          或拖拽划线至右侧草稿
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {empty ? (
          <div className="text-tiny text-line-3 text-center px-2 py-6 leading-relaxed">
            在材料中划线后<br />会出现在这里
          </div>
        ) : (
          groups.map(({ mat, items }) => (
            <div key={mat.id} className="mb-3">
              <div className="text-tiny text-ink-3 font-semibold px-1 mb-1">
                {mat.title}
              </div>
              {items.map((h) => (
                <Tooltip key={h.key} label="拖到草稿 · 双击发送">
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', `「${h.text}」`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDoubleClick={() => onSendToScratch(`「${h.text}」（${mat.title}）`)}
                    onKeyDown={(e) => {
                      // a11y keyboard fallback: Enter / Space = 等价于 double-click 发送
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSendToScratch(`「${h.text}」（${mat.title}）`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`划线: ${h.text}. Enter 发送到草稿`}
                    className={cn(
                      'relative bg-surface border border-line border-l-2 border-l-accent',
                      'rounded-tiny px-2 py-2 mb-1 cursor-grab font-serif',
                      'text-xs text-ink-3 leading-snug',
                    )}
                    style={{ paddingRight: 22 }} /* hardcode-allow: 22px right padding leaves room for the × delete button */
                    data-testid={`exam-highlight-rail-item-${h.matId}-${h.idx}`}
                  >
                    {h.text.length > 56 ? h.text.slice(0, 56) + '…' : h.text}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(h.matId, h.idx);
                      }}
                      className="absolute top-1 right-1 w-4 h-4 text-line-3 cursor-pointer flex items-center justify-center" /* hardcode-allow: 16px × button on chip corner */
                      aria-label="删除划线"
                    >
                      <XCloseIcon className="w-3 h-3" />
                    </button>
                  </div>
                </Tooltip>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
