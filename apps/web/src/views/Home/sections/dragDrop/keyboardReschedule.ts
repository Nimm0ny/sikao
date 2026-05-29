/*
 * keyboardReschedule — SIK-139 W4.
 *
 * Why: design.md "W4 Keyboard Reschedule Design" requires the keyboard
 *      reschedule to step by WHOLE DAY cells, not dnd-kit's default
 *      fixed-pixel translate (which can't reliably cross a 7-col grid cell
 *      or jump a week). This module extracts the two pure pieces of that
 *      design so they are unit-tested in isolation (same DI recipe as W2
 *      `resolveCalendarDrop` / W3 `runConflictGate`):
 *        1. `stepDayCoordinate` — a custom `KeyboardCoordinateGetter` that
 *           snaps the dragged chip onto the nearest day cell in the pressed
 *           arrow direction (one day L/R, one week U/D). Modeled on dnd-kit
 *           sortable's `sortableKeyboardCoordinates` (directional filter +
 *           closest pick) but grid-aware and dependency-light so it is pure.
 *        2. `buildRescheduleAnnouncements` — the Chinese aria-live copy fed
 *           to `<DndContext accessibility={{ announcements }}>` so the live
 *           region narrates the candidate date instead of dnd-kit's default
 *           English over-id message.
 *
 *      AGENT-H7: a boundary press (no cell in that direction) returns
 *      `undefined` — dnd-kit keeps the chip in place, no wrap to the opposite
 *      edge (which would silently reschedule to the wrong day). The actual
 *      commit on Enter still flows through the SAME `onDragEnd` →
 *      resolveCalendarDrop → runConflictGate → commitReschedule path; this
 *      module never commits or writes the store.
 */
import { KeyboardCode, type KeyboardCoordinateGetter } from '@dnd-kit/core';
import type { Active, Over } from '@dnd-kit/core';

/** Minimal cell rectangle (the subset of dnd-kit's ClientRect we read). */
export interface CellRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** Context subset the coordinate getter needs (from dnd-kit SensorContext). */
export interface StepDayContext {
  readonly collisionRect: CellRect | null;
  readonly droppableRects: ReadonlyMap<string, CellRect>;
  /**
   * The currently-over day cell's rect, if any. Preferred anchor: it is a
   * CLEAN cell rect, whereas `collisionRect` is the dragged chip's rect — the
   * chip is small and sits near the bottom of (or overflows) its 88px cell,
   * so anchoring stepping to the chip geometry mis-picks a vertically-closer
   * next-row cell. Falls back to the cell containing the chip's top-left
   * corner when `over` is not yet set (e.g. the first key after pickup).
   */
  readonly overRect?: CellRect | null;
}

const ARROW_CODES: ReadonlySet<string> = new Set([
  KeyboardCode.Left,
  KeyboardCode.Right,
  KeyboardCode.Up,
  KeyboardCode.Down,
]);

/**
 * Resolve the anchor CELL to step from: the currently-over cell when known,
 * otherwise the cell whose bounds contain the chip's top-left corner (the
 * chip can overflow its cell's bottom, so the top-left is the reliable probe,
 * not the center). Returns null when neither resolves.
 */
function resolveAnchorCell(ctx: StepDayContext): CellRect | null {
  if (ctx.overRect) return ctx.overRect;
  const cr = ctx.collisionRect;
  if (!cr) return null;
  for (const rect of ctx.droppableRects.values()) {
    if (cr.left >= rect.left && cr.left < rect.right && cr.top >= rect.top && cr.top < rect.bottom) {
      return rect;
    }
  }
  return null;
}

/**
 * Pick the adjacent cell in the pressed direction, stepping by a WHOLE day
 * (left/right within the same row) or a WHOLE week (up/down within the same
 * column). Row/column membership is decided by overlap against the anchor's
 * own height / width so sub-pixel rect noise doesn't split a row.
 */
function stepFrom(code: string, anchor: CellRect, rects: Iterable<CellRect>): CellRect | null {
  const rowTol = anchor.height / 2;
  const colTol = anchor.width / 2;
  let best: CellRect | null = null;
  for (const rect of rects) {
    let candidate = false;
    switch (code) {
      case KeyboardCode.Right:
        candidate = Math.abs(rect.top - anchor.top) < rowTol && rect.left > anchor.left + 1;
        if (candidate && (best == null || rect.left < best.left)) best = rect;
        break;
      case KeyboardCode.Left:
        candidate = Math.abs(rect.top - anchor.top) < rowTol && rect.left < anchor.left - 1;
        if (candidate && (best == null || rect.left > best.left)) best = rect;
        break;
      case KeyboardCode.Down:
        candidate = Math.abs(rect.left - anchor.left) < colTol && rect.top > anchor.top + 1;
        if (candidate && (best == null || rect.top < best.top)) best = rect;
        break;
      case KeyboardCode.Up:
        candidate = Math.abs(rect.left - anchor.left) < colTol && rect.top < anchor.top - 1;
        if (candidate && (best == null || rect.top > best.top)) best = rect;
        break;
      default:
        break;
    }
  }
  return best;
}

/**
 * Custom `KeyboardCoordinateGetter`: on an arrow key, snap the dragged chip
 * onto the nearest day cell in that direction (one day left/right, one week
 * up/down). Returns the ABSOLUTE top-left coordinate of the chosen cell
 * (dnd-kit derives the move delta from `currentCoordinates` itself).
 *
 * Returns `undefined` for non-arrow keys, an inactive drag, or a boundary
 * press with no cell in that direction (AGENT-H7: no wrap, no guess — the
 * chip simply stays put).
 *
 * The signature is wider than `StepDayContext` so it satisfies dnd-kit's
 * `KeyboardCoordinateGetter` when assigned to a sensor (the extra
 * SensorContext fields are unused here).
 */
export function stepDayCoordinate(
  event: Pick<KeyboardEvent, 'code'>,
  ctx: StepDayContext,
): { x: number; y: number } | undefined {
  if (!ARROW_CODES.has(event.code)) return undefined;
  if (!ctx.collisionRect) return undefined;

  const anchor = resolveAnchorCell(ctx);
  if (!anchor) return undefined;

  const next = stepFrom(event.code, anchor, ctx.droppableRects.values());
  if (!next) return undefined;
  return { x: next.left, y: next.top };
}

/** Adapter: assign this to `KeyboardSensor`'s `coordinateGetter` option. */
export const dayCellCoordinateGetter: KeyboardCoordinateGetter = (event, args) => {
  const overId = args.context.over?.id;
  const droppableRects = args.context.droppableRects as ReadonlyMap<string, CellRect>;
  const overRect = overId == null ? null : droppableRects.get(String(overId)) ?? null;
  return stepDayCoordinate(event, {
    collisionRect: args.context.collisionRect,
    droppableRects,
    overRect,
  });
};

const CANDIDATE_DATE_FMT = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

/**
 * Format a `YYYY-MM-DD` cell stamp into a zh-CN candidate-date label for the
 * aria-live announcement. Falls back to the raw stamp if unparseable
 * (AGENT-H7: no silent "today" guess).
 */
export function formatCellDate(stamp: string): string {
  const date = new Date(`${stamp}T00:00:00`);
  if (Number.isNaN(date.getTime())) return stamp;
  return CANDIDATE_DATE_FMT.format(date);
}

// lint-allow-ui-copy: SIK-139 W4 keyboard reschedule aria-live copy. Screen
// reader narration for the keyboard move mode (Requirement 5); CJK strings
// per design.md "W4 Keyboard Reschedule Design" announcement table.
const ANNOUNCE_COPY = {
  pickup: (title: string) =>
    `已拾起「${title}」，使用方向键改期，回车确认，Esc 取消`,
  over: (date: string) => `已移动到 ${date}`,
  committed: (title: string, date: string) => `已将「${title}」改期到 ${date}`,
  cancelled: '已取消改期',
} as const;

/** Fallback label when the dragged event carries no title on its drag data. */
const FALLBACK_TITLE = '事件';

/** dnd-kit Announcements shape (re-declared minimally to stay decoupled). */
interface RescheduleAnnouncements {
  onDragStart(args: { active: Active }): string | undefined;
  onDragOver(args: { active: Active; over: Over | null }): string | undefined;
  onDragEnd(args: { active: Active; over: Over | null }): string | undefined;
  onDragCancel(args: { active: Active; over: Over | null }): string | undefined;
}

/**
 * Read the dragged event's title off `active.data.current.title` (set by
 * MonthGridDnd's DraggableChip). A single DndContext-level announcements
 * object can't close over a per-chip title, so we resolve it per callback
 * from the active drag data, falling back to a generic label.
 */
function activeTitle(active: Active): string {
  const data = active.data.current as { title?: unknown } | undefined;
  return typeof data?.title === 'string' && data.title.length > 0
    ? data.title
    : FALLBACK_TITLE;
}

/**
 * Build the aria-live announcement callbacks for the keyboard reschedule.
 * Pure: reads the dragged title off `active.data.current.title` and the
 * candidate date off `over.id` (= the day cell stamp). Fed once to
 * `<DndContext accessibility={{ announcements }}>` and reused across drags.
 */
export function buildRescheduleAnnouncements(): RescheduleAnnouncements {
  return {
    onDragStart: ({ active }) => ANNOUNCE_COPY.pickup(activeTitle(active)),
    onDragOver: ({ over }) =>
      over == null ? undefined : ANNOUNCE_COPY.over(formatCellDate(String(over.id))),
    onDragEnd: ({ active, over }) =>
      over == null
        ? ANNOUNCE_COPY.cancelled
        : ANNOUNCE_COPY.committed(activeTitle(active), formatCellDate(String(over.id))),
    onDragCancel: () => ANNOUNCE_COPY.cancelled,
  };
}
