/*
 * keyboardReschedule tests — SIK-139 W4.
 *
 * Why: Requirement 5 (a11y) demands the keyboard reschedule step by WHOLE
 *      DAY cells, not dnd-kit's default fixed-pixel translate. design.md
 *      "W4 Keyboard Reschedule Design" extracts the cell-stepping math into
 *      the pure `stepDayCoordinate` (a custom KeyboardCoordinateGetter) and
 *      the aria-live copy into the pure `buildRescheduleAnnouncements`, both
 *      unit-tested here in isolation (same DI recipe as W2 resolveCalendarDrop
 *      / W3 runConflictGate).
 */
import { describe, it, expect } from 'vitest';
import { KeyboardCode } from '@dnd-kit/core';

import {
  stepDayCoordinate,
  buildRescheduleAnnouncements,
  formatCellDate,
  type CellRect,
} from './keyboardReschedule';

/**
 * 7-col month grid mock: 2 rows x 7 cols, 100x88 cells, no gaps.
 * Row 0 = days 1..7 (top=0), Row 1 = days 8..14 (top=88).
 */
const CELL_W = 100;
const CELL_H = 88;
function rect(col: number, row: number): CellRect {
  const left = col * CELL_W;
  const top = row * CELL_H;
  return { left, top, right: left + CELL_W, bottom: top + CELL_H, width: CELL_W, height: CELL_H };
}

/** droppableRects map keyed like the grid (cell.stamp), plus geometry. */
function makeRects(): Map<string, CellRect> {
  const m = new Map<string, CellRect>();
  for (let i = 0; i < 14; i += 1) {
    const col = i % 7;
    const row = Math.floor(i / 7);
    m.set(`2026-05-${String(i + 1).padStart(2, '0')}`, rect(col, row));
  }
  return m;
}

/** Build the ctx arg the coordinate getter reads (subset of SensorContext). */
function ctxAt(col: number, row: number) {
  return { collisionRect: rect(col, row), droppableRects: makeRects() };
}

function keyEvent(code: KeyboardCode): KeyboardEvent {
  return { code } as KeyboardEvent;
}

describe('stepDayCoordinate (SIK-139 W4 — whole-day cell stepping)', () => {
  it('ArrowRight steps to the next day cell (one column right, same row)', () => {
    const next = stepDayCoordinate(keyEvent(KeyboardCode.Right), ctxAt(2, 0));
    // expect the left/top of col 3 row 0
    expect(next).toEqual({ x: 3 * CELL_W, y: 0 });
  });

  it('ArrowLeft steps to the previous day cell (one column left)', () => {
    const next = stepDayCoordinate(keyEvent(KeyboardCode.Left), ctxAt(2, 0));
    expect(next).toEqual({ x: 1 * CELL_W, y: 0 });
  });

  it('ArrowDown steps to the same column one week down', () => {
    const next = stepDayCoordinate(keyEvent(KeyboardCode.Down), ctxAt(2, 0));
    expect(next).toEqual({ x: 2 * CELL_W, y: CELL_H });
  });

  it('ArrowUp steps to the same column one week up', () => {
    const next = stepDayCoordinate(keyEvent(KeyboardCode.Up), ctxAt(2, 1));
    expect(next).toEqual({ x: 2 * CELL_W, y: 0 });
  });

  it('returns undefined at the left boundary (no wrap to the other side)', () => {
    expect(stepDayCoordinate(keyEvent(KeyboardCode.Left), ctxAt(0, 0))).toBeUndefined();
  });

  it('returns undefined at the bottom boundary (no wrap)', () => {
    expect(stepDayCoordinate(keyEvent(KeyboardCode.Down), ctxAt(3, 1))).toBeUndefined();
  });

  it('returns undefined for a non-arrow key (hands control back to dnd-kit)', () => {
    expect(stepDayCoordinate(keyEvent(KeyboardCode.Space), ctxAt(2, 0))).toBeUndefined();
  });

  it('returns undefined when there is no collisionRect (drag not active)', () => {
    const next = stepDayCoordinate(keyEvent(KeyboardCode.Right), {
      collisionRect: null,
      droppableRects: makeRects(),
    });
    expect(next).toBeUndefined();
  });
});

describe('formatCellDate (SIK-139 W4 — aria-live candidate date)', () => {
  it('formats a YYYY-MM-DD stamp into a zh-CN month/day label', () => {
    // Locale formatting is environment-dependent; assert it contains the day
    // and is non-empty rather than pinning exact punctuation.
    const label = formatCellDate('2026-05-30');
    expect(label).toContain('30');
    expect(label.length).toBeGreaterThan(0);
  });

  it('falls back to the raw stamp for an unparseable value', () => {
    expect(formatCellDate('not-a-date')).toBe('not-a-date');
  });
});

describe('buildRescheduleAnnouncements (SIK-139 W4 — aria-live copy)', () => {
  const announce = buildRescheduleAnnouncements();

  // active carries the dragged title on `data.current.title` (set by
  // MonthGridDnd's DraggableChip); the announcements read it per callback.
  function active(title: string) {
    return { id: 'm1', data: { current: { title } } } as never;
  }
  function over(id: string | null) {
    return id == null ? null : ({ id } as never);
  }

  it('announces pick-up with the event title + keyboard hint on drag start', () => {
    const msg = announce.onDragStart({ active: active('行测套卷模考') });
    expect(msg).toContain('行测套卷模考');
    expect(msg).toContain('方向键');
  });

  it('announces the candidate date when the drop target changes', () => {
    const msg = announce.onDragOver?.({ active: active('行测套卷模考'), over: over('2026-05-30') });
    expect(msg).toContain('30');
  });

  it('says nothing extra (undefined) when there is no drop target on move', () => {
    const msg = announce.onDragOver?.({ active: active('行测套卷模考'), over: over(null) });
    expect(msg).toBeUndefined();
  });

  it('announces the committed date on drag end (over present)', () => {
    const msg = announce.onDragEnd({ active: active('行测套卷模考'), over: over('2026-05-30') });
    expect(msg).toContain('行测套卷模考');
    expect(msg).toContain('30');
  });

  it('announces cancellation on drag end with no target', () => {
    const msg = announce.onDragEnd({ active: active('行测套卷模考'), over: over(null) });
    expect(msg).toContain('取消');
  });

  it('announces cancellation on drag cancel (Esc)', () => {
    const msg = announce.onDragCancel({ active: active('行测套卷模考'), over: over(null) });
    expect(msg).toContain('取消');
  });

  it('falls back to a generic label when the dragged title is missing', () => {
    const msg = announce.onDragStart({ active: { id: 'm1', data: { current: {} } } as never });
    expect(msg).toContain('事件');
  });
});
