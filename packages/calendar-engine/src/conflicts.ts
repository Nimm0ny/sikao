import type { CalendarOccurrence, ConflictItem } from './types';

function overlaps(left: CalendarOccurrence, right: CalendarOccurrence): boolean {
  return (
    new Date(left.startAt) < new Date(right.endAt) &&
    new Date(right.startAt) < new Date(left.endAt)
  );
}

export function detectConflicts(occurrences: readonly CalendarOccurrence[]): ConflictItem[] {
  const sorted = [...occurrences].sort(
    (left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
  );
  const conflicts: ConflictItem[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    for (let nextIndex = index + 1; nextIndex < sorted.length; nextIndex += 1) {
      const next = sorted[nextIndex];
      if (new Date(next.startAt) >= new Date(current.endAt)) break;
      if (!overlaps(current, next)) continue;
      conflicts.push({
        leftId: current.occurrenceRef,
        rightId: next.occurrenceRef,
        leftStartAt: current.startAt,
        leftEndAt: current.endAt,
        rightStartAt: next.startAt,
        rightEndAt: next.endAt,
      });
    }
  }

  return conflicts;
}
