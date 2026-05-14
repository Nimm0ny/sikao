// MaterialPanel — top-left panel: shows the active material's title + body
// in serif 17/1.78 reading mode. Pre-existing highlights from the store are
// rendered as draggable MaterialClip spans inline (the user already clicked
// to mark them via the legacy MaterialReader flow OR the SIKAO MaterialPanel
// Mark mode — both write `highlights[matId]`).
//
// Reads the store directly: highlights, paper.materials, matIdx. Spec
// 04-essay.md: 题面 / Material 标题 / 正文 (衬线 17/1.78) / 划线短语带 ⋮⋮
// grip · draggable.
//
// Why slice the body into ranges client-side: highlights live as
// {start, end} on the existing store. Rendering the body as a contiguous
// block of <Text>(<Clip>...)</Text> nodes preserves IME / copy-paste
// behaviour (no contenteditable) while making each highlight individually
// draggable.

import { useMemo } from 'react';
import { MaterialClip } from './MaterialClip';
import { buildSourceLabel } from './lib/sourceLabel';
import type { Material, Highlight } from '@sikao/domain/shenlun/types';

export interface MaterialPanelProps {
  readonly material: Material;
  readonly matIndex: number; // 0-based; sourceLabel adds 1 for display
  readonly highlights: readonly Highlight[];
}

interface BodySegment {
  readonly type: 'text' | 'clip';
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

function splitBody(
  body: string,
  ranges: readonly Highlight[],
): BodySegment[] {
  // Defensive: ranges may overlap or extend past body length when stale.
  // Sort + clamp so the linear walk below produces a clean partition.
  const sorted = [...ranges]
    .filter((r) => r.start < r.end && r.start >= 0 && r.end <= body.length)
    .sort((a, b) => a.start - b.start);
  const out: BodySegment[] = [];
  let cursor = 0;
  for (const r of sorted) {
    // Skip overlapping ranges — keep the first, drop later ones whose start
    // is inside an already-emitted clip.
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

export function MaterialPanel({
  material,
  matIndex,
  highlights,
}: MaterialPanelProps) {
  const segments = useMemo(
    () => splitBody(material.body, highlights),
    [material.body, highlights],
  );

  return (
    <section
      className="bg-surface border border-line rounded-card flex flex-col min-h-0 overflow-hidden"
      data-testid="essay-material-panel"
      data-mat-id={material.id}
    >
      <header className="px-5 py-3 border-b border-line shrink-0 bg-paper-3">
        <h3
          className="font-serif text-ink"
          style={{ fontSize: 18, lineHeight: 1.4 }} /* hardcode-allow: material title 18px between --t-h3 22 and --t-body 15 */
        >
          {material.title}
        </h3>
        {material.subtitle ? (
          <div className="text-tiny text-ink-4 font-mono mt-1">
            {material.subtitle}
          </div>
        ) : null}
      </header>
      <div
        className="flex-1 overflow-y-auto px-6 py-4 min-h-0 font-serif text-ink"
        style={{
          fontSize: 'var(--read-fs, 17px)',
          lineHeight: 'var(--read-lh, 1.78)',
        }}
        data-testid="essay-material-panel-body"
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {segments.map((seg, idx) => {
            if (seg.type === 'text') {
              return <span key={`t-${idx}-${seg.start}`}>{seg.text}</span>;
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
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
