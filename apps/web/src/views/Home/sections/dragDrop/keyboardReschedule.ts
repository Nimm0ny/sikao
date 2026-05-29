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
}

const ARROW_CODES: ReadonlySet<string> = new Set([
  KeyboardCode.Left,
  KeyboardCode.Right,
  KeyboardCode.Up,
  KeyboardCode.Down,
]);

/** Squared distance between two rect top-left corners (no sqrt needed). */
function cornerDistanceSq(a: CellRect, b: CellRect): number {
  const dx = a.left - b.left;
  const dy = a.top - b.top;
  return dx * dx + dy * dy;
}

/**
 * Keep only the cells that lie in the pressed direction relative to the
 * current collision rect (mirrors sortableKeyboardCoordinates' directional
 * filter): Right → strictly to the right, Down → strictly below, etc.
 */
function inDirection(code: string, current: CellRect, candidate: CellRect): boolean {
  switch (code) {
    case KeyboardCode.Right:
      return candidate.left > current.left;
    case KeyboardCode.Left:
      return candidate.left < current.left;
    case KeyboardCode.Down:
      return candidate.top > current.top;
    case KeyboardCode.Up:
      return candidate.top < current.top;
    default:
      return false;
  }
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
  const { collisionRect } = ctx;
  if (!collisionRect) return undefined;

  let best: CellRect | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const rect of ctx.droppableRects.values()) {
    if (!inDirection(event.code, collisionRect, rect)) continue;
    const distSq = cornerDistanceSq(collisionRect, rect);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = rect;
    }
  }
  if (!best) return undefined;
  return { x: best.left, y: best.top };
}

/** Adapter: assign this to `KeyboardSensor`'s `coordinateGetter` option. */
export const dayCellCoordinateGetter: KeyboardCoordinateGetter = (event, args) =>
  stepDayCoordinate(event, {
    collisionRect: args.context.collisionRect,
    droppableRects: args.context.droppableRects as ReadonlyMap<string, CellRect>,
  });

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
