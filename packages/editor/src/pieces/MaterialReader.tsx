import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FontSizeMinusIcon,
  FontSizePlusIcon,
  PenIcon,
} from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import type { Highlight, Material } from '@sikao/domain/shenlun/types';
import { buildSegments, selectionOffsets } from '@sikao/answer-engine/highlight/highlightRanges';
import { ParticleBurst, type BurstSpec } from './ParticleBurst';

// 14 props was past CLAUDE.md §4 「参数 ≤4」 — bundled into 4 cohesive
// option objects so call sites group related concerns. Naming follows
// "what does this prop control" rather than the underlying state shape.
interface MarkingProps {
  highlights: readonly Highlight[];
  marking: boolean;
  toggle: () => void;
  onAdd: (range: Highlight) => void;
}

interface SearchProps {
  query: string;
  noMatchOnThisTab: boolean;
  otherMatchCount: number;
  firstOtherHitMaterial?: Material;
  onJumpToFirstHit?: () => void;
}

interface NavProps {
  matIdx: number;
  total: number;
  onJumpPrev?: () => void;
  onJumpNext?: () => void;
}

interface TypographyProps {
  fontSize: number;
  bumpFontSize: (delta: 1 | -1) => void;
}

interface Props {
  material: Material;
  marking: MarkingProps;
  search: SearchProps;
  nav: NavProps;
  typography: TypographyProps;
}

// MaterialReader — toolbar (划线 toggle / 划线计数 / 字号控制) + scrollable
// body (sticky no-match jump banner + title + subtitle + segmented body) +
// footer (← prev / N/total · 字数 / next →).

export function MaterialReader({ material, marking, search, nav, typography }: Props) {
  const { highlights, marking: isMarking, toggle: toggleMarking, onAdd: onAddHighlight } = marking;
  const { query, noMatchOnThisTab, otherMatchCount, firstOtherHitMaterial, onJumpToFirstHit } = search;
  const { matIdx, total, onJumpPrev, onJumpNext } = nav;
  const { fontSize, bumpFontSize } = typography;
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [burst, setBurst] = useState<BurstSpec | null>(null);
  const burstIdRef = useRef(0);

  const handleMouseUp = () => {
    if (!isMarking) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const node = bodyRef.current;
    if (!node) return;
    // selectionOffsets only checks startContainer; if the user dragged out of
    // the body node (toolbar / footer / banner), commonAncestorContainer ends
    // up outside `node` and the resulting offsets straddle non-body text.
    // Reject those selections outright.
    if (!node.contains(range.commonAncestorContainer)) return;
    const offsets = selectionOffsets(node, range);
    if (!offsets) return;
    onAddHighlight({ ...offsets, _justAdded: Date.now() });
    // particle burst at the selection midpoint, anchored to the scroller so
    // the burst stays put if the user scrolls afterwards
    const sr = range.getBoundingClientRect();
    const scrollerEl = scrollerRef.current;
    if (scrollerEl) {
      const sRect = scrollerEl.getBoundingClientRect();
      burstIdRef.current += 1;
      setBurst({
        id: burstIdRef.current,
        x: sr.left + sr.width / 2 - sRect.left + scrollerEl.scrollLeft,
        y: sr.top + sr.height / 2 - sRect.top + scrollerEl.scrollTop,
      });
    }
    sel.removeAllRanges();
  };

  // Scroll to first search hit when query / material changes.
  // The querySelector is scoped to bodyRef (this component's own subtree),
  // not document — frontend §2.6's "no document.getElementById" rule is
  // about cross-component DOM lookups; reaching into a ref'd subtree is
  // the standard React imperative escape hatch. Tracking which segment is
  // the first hit via state would mean re-rendering the whole body on
  // every query keystroke just to reuse a ref-array, so this stays.
  useEffect(() => {
    if (!query.trim() || !bodyRef.current || !scrollerRef.current) return;
    const id = window.setTimeout(() => {
      const first = bodyRef.current?.querySelector<HTMLElement>('mark[data-hit="hit"]');
      if (first) {
        const top = first.offsetTop - 60;
        scrollerRef.current?.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, [query, material.id]);

  const segments = buildSegments(material.body, highlights, query);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* toolbar — 划线 toggle + 划线计数 + 字号控制 */}
      <div className="px-4 pt-3 pb-3 flex items-center gap-2 shrink-0">
        <Tooltip label={isMarking ? '退出划线' : '开启划线 — 拖选材料文字标注'}>
          <button
            type="button"
            onClick={toggleMarking}
            className={cn(
              'px-3 py-2 border rounded-tiny text-xs font-semibold cursor-pointer',
              'inline-flex items-center gap-1 transition-all duration-base',
              isMarking
                ? 'border-accent bg-accent-50 text-accent shadow-[0_0_0_3px_rgba(63,126,241,.12)]' /* hardcode-allow: 3px focus-glow ring matches design v2 token */
                : 'border-line bg-surface text-ink-3 hover:bg-surface-alt',
            )}
            data-testid="exam-materials-marking-toggle"
            aria-pressed={isMarking}
            aria-label={isMarking ? '退出划线' : '开启划线'}
          >
            <PenIcon className="w-3 h-3" />
          </button>
        </Tooltip>
        {highlights.length > 0 && (
          <span
            className="text-xs text-accent font-semibold exam-ink-fade"
            data-testid="exam-materials-marking-count"
          >
            · {highlights.length} 处
          </span>
        )}
        <div className="flex-1" />
        <div className="flex items-center border border-line rounded-tiny overflow-hidden bg-surface">
          <Tooltip label="缩小字号">
            <button
              type="button"
              onClick={() => bumpFontSize(-1)}
              aria-label="缩小字号"
              className="w-7 h-7 cursor-pointer text-ink-3 text-xs font-bold"
            data-testid="exam-materials-font-down"
          >
            <FontSizeMinusIcon className="w-3 h-3" />
          </button>
        </Tooltip>
          <span className="w-px h-3.5 bg-line" aria-hidden /> {/* hardcode-allow: 14px hairline divider, sub-token */}
          <span
            className="w-7 text-center text-tiny text-ink-4 font-mono tabular-nums"
            data-testid="exam-materials-font-size"
          >
            {fontSize}
          </span>
          <span className="w-px h-3.5 bg-line" aria-hidden /> {/* hardcode-allow: matches divider above */}
          <Tooltip label="放大字号">
            <button
              type="button"
              onClick={() => bumpFontSize(1)}
              aria-label="放大字号"
              className="w-7 h-7 cursor-pointer text-ink-3 text-xs font-bold"
            data-testid="exam-materials-font-up"
          >
            <FontSizePlusIcon className="w-3 h-3" />
          </button>
        </Tooltip>
        </div>
      </div>

      {/* body — title / subtitle / segmented prose; cursor flips when marking */}
      <div
        ref={scrollerRef}
        className={cn(
          'flex-1 overflow-y-auto px-5 pb-6 relative',
          isMarking ? 'cursor-text' : 'cursor-auto',
        )}
        data-testid="exam-materials-body-scroller"
      >
        {noMatchOnThisTab && firstOtherHitMaterial && onJumpToFirstHit && (
          <div
            className={cn(
              'sticky top-0 z-2 mb-3 px-3 py-2 rounded-tiny',
              'bg-warn-bg border border-warn/40 flex items-center gap-2',
              'text-xs text-warn',
            )}
            data-testid="exam-materials-no-match-banner"
          >
            <span className="flex-1">
              本资料无 "<b>{query.trim()}</b>" 的命中 · 其它资料共 {otherMatchCount} 处
            </span>
            <Tooltip label={`跳到 ${firstOtherHitMaterial.title}`}>
              <button
                type="button"
                onClick={onJumpToFirstHit}
                aria-label={`跳到 ${firstOtherHitMaterial.title}`}
                className="w-7 h-7 inline-flex items-center justify-center border border-warn bg-surface text-warn rounded-tiny cursor-pointer"
              >
                <ChevronRightIcon className="w-3 h-3" />
              </button>
            </Tooltip>
          </div>
        )}
        <div className="text-md font-bold text-ink mb-1 font-serif">{material.title}</div>
        <div className="text-xs text-ink-3 mb-3 font-medium">{material.subtitle}</div>
        {/* a11y: 用户在 reader body 鼠标选区后捕获 selection 加 highlight. 是
            mouse-only 高亮 enhancement, 不影响 reading 主体. screen reader 走文本朗读,
            不参与 highlight 交互. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          ref={bodyRef}
          onMouseUp={handleMouseUp}
          className="text-ink-3 text-justify font-serif"
          style={{ fontSize, lineHeight: 1.85, whiteSpace: 'pre-line' }}
          data-testid="exam-materials-body"
        >
          {segments.map((seg, idx) => {
            if (seg.kind === 'plain') return <span key={`p-${idx}`}>{seg.text}</span>;
            const isMark = seg.kind === 'mark';
            // hl-pulse: key includes justAdded timestamp so a freshly-added
            // mark mounts a brand-new <mark> element. The CSS animation
            // fires once on mount and never again — no Date.now() in render
            // and no setState-in-effect tracking.
            const key = `${seg.kind}-${seg.start}-${seg.end}-${seg.justAdded ?? 0}`;
            return (
              <mark
                key={key}
                data-hit={seg.kind}
                className={isMark && seg.justAdded ? 'exam-hl-pulse-once' : undefined}
                style={{
                  background: isMark ? 'var(--exam-mark-bg)' : 'var(--exam-hit-bg)',
                  color: 'var(--ink-1)',
                  padding: '0 1px',
                  borderRadius: 2,
                  boxShadow: isMark
                    ? 'inset 0 -2px 0 var(--exam-mark-rule)'
                    : 'inset 0 -2px 0 var(--exam-hit-rule)',
                }}
              >
                {seg.text}
              </mark>
            );
          })}
        </div>
        <ParticleBurst burst={burst} onDone={() => setBurst(null)} />
      </div>

      {/* footer — prev / count + 字数 / next */}
      <div className="border-t border-line shrink-0 flex items-stretch h-10">
        <Tooltip label="上一篇材料">
          <button
            type="button"
            onClick={onJumpPrev}
            disabled={matIdx === 0}
            aria-label="上一篇材料"
            className={cn(
              'flex-1 px-3 cursor-pointer inline-flex items-center justify-start',
              'transition-colors duration-base',
              matIdx === 0 ? 'text-line-3 cursor-not-allowed' : 'text-ink-3 hover:bg-surface-alt',
            )}
          >
            <ChevronLeftIcon className="w-3 h-3" />
          </button>
        </Tooltip>
        <span className="w-px bg-line" aria-hidden />
        <div className="px-4 inline-flex items-center gap-2 text-tiny text-ink-4 font-mono tabular-nums">
          <span className="text-ink font-bold">{matIdx + 1}</span>
          <span>/</span>
          <span>{total}</span>
          <span className="w-px h-3 bg-line mx-1" aria-hidden /> {/* hardcode-allow: 12px hairline */}
          <span data-testid="exam-materials-footer-charcount">{material.body.length} 字</span>
        </div>
        <span className="w-px bg-line" aria-hidden />
        <Tooltip label="下一篇材料">
          <button
            type="button"
            onClick={onJumpNext}
            disabled={matIdx === total - 1}
            aria-label="下一篇材料"
            className={cn(
              'flex-1 px-3 cursor-pointer inline-flex items-center justify-end',
              'transition-colors duration-base',
              matIdx === total - 1
                ? 'text-line-3 cursor-not-allowed'
                : 'text-ink-3 hover:bg-surface-alt',
            )}
          >
            <ChevronRightIcon className="w-3 h-3" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
