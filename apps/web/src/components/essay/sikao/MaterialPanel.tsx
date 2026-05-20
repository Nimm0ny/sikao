import { useCallback, useMemo, useRef } from 'react';
import { Tooltip } from '@sikao/ui/ui/Tooltip';
import { IconBtn } from '@sikao/ui/ui/IconBtn';
import {
  FormatHighlightIcon,
  FormatUnderlineIcon,
  TrashIcon,
} from '@sikao/ui/icons';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { MaterialClip } from './MaterialClip';
import { buildSourceLabel } from './lib/sourceLabel';
import type { Material, Highlight } from '@sikao/domain/shenlun/types';

export interface MaterialPanelProps {
  readonly material: Material;
  readonly matIndex: number;
  readonly highlights: readonly Highlight[];
}

interface BodySegment {
  readonly type: 'text' | 'clip';
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly kind?: 'underline' | 'highlight';
}

const TAB_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

function splitBody(body: string, ranges: readonly Highlight[]): BodySegment[] {
  const sorted = [...ranges]
    .filter((r) => r.start < r.end && r.start >= 0 && r.end <= body.length)
    .sort((a, b) => a.start - b.start);
  const out: BodySegment[] = [];
  let cursor = 0;
  for (const r of sorted) {
    if (r.start < cursor) continue;
    if (r.start > cursor) {
      out.push({
        type: 'text',
        text: body.slice(cursor, r.start),
        start: cursor,
        end: r.start,
      });
    }
    out.push({
      type: 'clip',
      text: body.slice(r.start, r.end),
      start: r.start,
      end: r.end,
      kind: r.kind ?? 'highlight',
    });
    cursor = r.end;
  }
  if (cursor < body.length) {
    out.push({
      type: 'text',
      text: body.slice(cursor),
      start: cursor,
      end: body.length,
    });
  }
  return out;
}

function textOffsetWithin(root: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  throw new Error('MaterialPanel selection is outside material body');
}

function readSelectedRange(root: HTMLElement): Pick<Highlight, 'start' | 'end'> | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = textOffsetWithin(root, range.startContainer, range.startOffset);
  const end = textOffsetWithin(root, range.endContainer, range.endOffset);
  const normalized = start <= end ? { start, end } : { start: end, end: start };
  if (normalized.start === normalized.end) return null;
  return normalized;
}

export function MaterialPanel({
  material,
  matIndex,
  highlights,
}: MaterialPanelProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const paper = useExamSession((s) => s.paper);
  const setMatIdx = useExamSession((s) => s.setMatIdx);
  const setHighlights = useExamSession((s) => s.setHighlights);

  const segments = useMemo(
    () => splitBody(material.body, highlights),
    [material.body, highlights],
  );

  const applyAnnotation = useCallback(
    (kind: 'underline' | 'highlight') => {
      const root = bodyRef.current;
      if (!root) return;
      const selected = readSelectedRange(root);
      if (!selected) return;
      setHighlights((prev) => {
        const existing = prev[material.id] ?? [];
        return {
          ...prev,
          [material.id]: [...existing, { ...selected, kind }],
        };
      });
      window.getSelection()?.removeAllRanges();
    },
    [material.id, setHighlights],
  );

  const clearAnnotations = useCallback(() => {
    setHighlights((prev) => ({ ...prev, [material.id]: [] }));
  }, [material.id, setHighlights]);

  return (
    <section
      className="essay-material-panel-proto flex flex-col min-h-0 overflow-hidden"
      data-testid="essay-material-panel"
      data-mat-id={material.id}
    >
      <div className="essay-material-toolbar">
        {paper && paper.materials.length > 1 ? (
          <nav
            className="essay-material-tabs"
            aria-label={ESSAY_SIKAO_COPY.materialTabs}
          >
            {paper.materials.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="essay-proto-tab"
                data-active={index === matIndex}
                data-testid={`essay-material-tab-${item.id}`}
                onClick={() => setMatIdx(index)}
              >
                {TAB_LABELS[index] ?? String(index + 1)}
              </button>
            ))}
          </nav>
        ) : (
          <div />
        )}
        <div className="essay-material-actions" aria-label={ESSAY_SIKAO_COPY.materialToolbar}>
          <span className="essay-proto-toolbar-divider" aria-hidden="true" />
          <Tooltip label={ESSAY_SIKAO_COPY.materialUnderline} side="bottom">
            <IconBtn
              aria-label={ESSAY_SIKAO_COPY.materialUnderline}
              className="essay-proto-iconbtn"
              onClick={() => applyAnnotation('underline')}
              data-testid="essay-material-underline"
            >
              <FormatUnderlineIcon size={15} />
            </IconBtn>
          </Tooltip>
          <Tooltip label={ESSAY_SIKAO_COPY.materialHighlight} side="bottom">
            <IconBtn
              aria-label={ESSAY_SIKAO_COPY.materialHighlight}
              className="essay-proto-iconbtn"
              onClick={() => applyAnnotation('highlight')}
              data-testid="essay-material-highlight"
            >
              <FormatHighlightIcon size={15} />
            </IconBtn>
          </Tooltip>
          <Tooltip label={ESSAY_SIKAO_COPY.materialClear} side="bottom">
            <IconBtn
              aria-label={ESSAY_SIKAO_COPY.materialClear}
              className="essay-proto-iconbtn"
              onClick={clearAnnotations}
              data-testid="essay-material-clear"
            >
              <TrashIcon size={15} />
            </IconBtn>
          </Tooltip>
        </div>
      </div>
      <div className="sr-only">
        <h3>{material.title}</h3>
        {material.subtitle ? <span>{material.subtitle}</span> : null}
      </div>
      <div
        ref={bodyRef}
        className="essay-material-body-proto flex-1 overflow-y-auto min-h-0 font-serif text-ink"
        data-testid="essay-material-panel-body"
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {segments.map((seg, idx) => {
            if (seg.type === 'text') {
              return (
                <span key={`t-${idx}-${seg.start}`} data-material-text>
                  {seg.text}
                </span>
              );
            }
            const sourceLabel = buildSourceLabel(matIndex, material.body, seg.start);
            return (
              <MaterialClip
                key={`c-${seg.start}-${seg.end}`}
                matId={material.id}
                start={seg.start}
                end={seg.end}
                text={seg.text}
                sourceLabel={sourceLabel}
                kind={seg.kind}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
