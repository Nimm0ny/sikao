import type { Highlight } from '@sikao/domain/shenlun/types';

// Helpers for the materials panel — turning store state (offset-based
// highlights + a search query) into segments for the body renderer, and
// turning a DOM Selection back into character offsets so saved highlights
// survive re-renders / tab switches.

export interface Segment {
  start: number;
  end: number;
  text: string;
  kind: 'plain' | 'hit' | 'mark';
  justAdded?: number;
}

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

export function escapeRegExp(str: string): string {
  return str.replace(ESCAPE_RE, '\\$&');
}

// Merge overlapping / adjacent highlight ranges so the renderer can treat
// them as a single contiguous mark instead of bumping into an empty plain
// segment between two abutting marks.
export function mergeHighlights(highlights: readonly Highlight[]): Highlight[] {
  if (highlights.length === 0) return [];
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const out: Highlight[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
      if (cur._justAdded) last._justAdded = cur._justAdded;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

// Build segments to render. Search hits override marks visually (kind='hit')
// when they overlap, since the user just typed a query and wants to see it.
export function buildSegments(
  text: string,
  highlights: readonly Highlight[],
  query: string,
): Segment[] {
  const merged = mergeHighlights(highlights);
  const ranges: { start: number; end: number; kind: 'mark' | 'hit'; justAdded?: number }[] = [];
  for (const r of merged) {
    ranges.push({ start: r.start, end: r.end, kind: 'mark', justAdded: r._justAdded });
  }
  const q = query.trim();
  if (q) {
    const re = new RegExp(escapeRegExp(q), 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      ranges.push({ start: m.index, end: m.index + q.length, kind: 'hit' });
    }
  }
  ranges.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    // mark before hit so an overlapping hit visually wins (renderer skips
    // overlap; this is just to keep ordering stable).
    return a.kind === 'mark' ? -1 : 1;
  });

  const segs: Segment[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue; // skip overlap
    if (cursor < r.start) {
      segs.push({ start: cursor, end: r.start, text: text.slice(cursor, r.start), kind: 'plain' });
    }
    segs.push({
      start: r.start,
      end: r.end,
      text: text.slice(r.start, r.end),
      kind: r.kind,
      justAdded: r.kind === 'mark' ? r.justAdded : undefined,
    });
    cursor = r.end;
  }
  if (cursor < text.length) {
    segs.push({ start: cursor, end: text.length, text: text.slice(cursor), kind: 'plain' });
  }
  return segs;
}

// Count how many times a query occurs in each material body (for tab badges).
export function countMatches(bodies: readonly string[], query: string): number[] {
  const q = query.trim();
  if (!q) return bodies.map(() => 0);
  return bodies.map((b) => {
    const re = new RegExp(escapeRegExp(q), 'g');
    let n = 0;
    while (re.exec(b) !== null) n += 1;
    return n;
  });
}

// Given a Selection range inside `containerNode`, compute the start/end
// character offsets relative to the container's textContent. Used when
// the user drags-selects in the body and the marker needs durable offsets.
export function selectionOffsets(
  containerNode: Node,
  range: Range,
): { start: number; end: number } | null {
  if (!containerNode.contains(range.startContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(containerNode);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const end = start + range.toString().length;
  if (end <= start) return null;
  return { start, end };
}
