import { describe, expect, it } from 'vitest';
import {
  buildSegments,
  countMatches,
  escapeRegExp,
  mergeHighlights,
} from '@sikao/answer-engine/highlight/highlightRanges';

describe('mergeHighlights', () => {
  it('returns empty array for no input', () => {
    expect(mergeHighlights([])).toEqual([]);
  });

  it('sorts ranges by start', () => {
    const merged = mergeHighlights([
      { start: 10, end: 12 },
      { start: 0, end: 5 },
    ]);
    expect(merged.map((r) => r.start)).toEqual([0, 10]);
  });

  it('merges overlapping ranges', () => {
    expect(
      mergeHighlights([
        { start: 0, end: 8 },
        { start: 5, end: 15 },
      ]),
    ).toEqual([{ start: 0, end: 15 }]);
  });

  it('merges abutting ranges (end == next start)', () => {
    expect(
      mergeHighlights([
        { start: 0, end: 5 },
        { start: 5, end: 10 },
      ]),
    ).toEqual([{ start: 0, end: 10 }]);
  });

  it('preserves _justAdded when merging', () => {
    const merged = mergeHighlights([
      { start: 0, end: 5 },
      { start: 4, end: 8, _justAdded: 12345 },
    ]);
    expect(merged[0]._justAdded).toBe(12345);
  });
});

describe('buildSegments', () => {
  it('returns a single plain segment when no highlights / query', () => {
    const segs = buildSegments('hello world', [], '');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ kind: 'plain', text: 'hello world' });
  });

  it('inserts a mark segment for a single highlight', () => {
    const segs = buildSegments('hello world', [{ start: 0, end: 5 }], '');
    expect(segs.map((s) => `${s.kind}:${s.text}`)).toEqual([
      'mark:hello',
      'plain: world',
    ]);
  });

  it('inserts hit segments for query matches', () => {
    const segs = buildSegments('foo bar foo', [], 'foo');
    expect(segs.map((s) => `${s.kind}:${s.text}`)).toEqual([
      'hit:foo',
      'plain: bar ',
      'hit:foo',
    ]);
  });

  it('skips overlapping ranges (later start before previous end)', () => {
    const segs = buildSegments('aaaaaaaa', [{ start: 0, end: 5 }, { start: 2, end: 4 }], '');
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ kind: 'mark', text: 'aaaaa' });
  });

  it('escapes regex metacharacters in the query', () => {
    const segs = buildSegments('a.b.c', [], '.');
    const hits = segs.filter((s) => s.kind === 'hit');
    expect(hits).toHaveLength(2);
  });
});

describe('countMatches', () => {
  it('returns zeros for empty query', () => {
    expect(countMatches(['hello', 'world'], '')).toEqual([0, 0]);
  });

  it('returns per-body counts', () => {
    expect(countMatches(['foo bar foo', 'no match', 'foo'], 'foo')).toEqual([2, 0, 1]);
  });

  it('respects regex escape', () => {
    expect(countMatches(['a.b.c', 'plain'], '.')).toEqual([2, 0]);
  });
});

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
  });
});
