import type { CalendarOccurrence, LayoutItem } from './types';

export function buildOverlapLayout(
  occurrences: readonly CalendarOccurrence[],
): Readonly<Record<string, LayoutItem>> {
  const sorted = [...occurrences].sort(
    (left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
  );
  const columns: { key: string; endAt: number }[] = [];
  const layout = new Map<string, LayoutItem>();

  for (const occurrence of sorted) {
    const startAt = new Date(occurrence.startAt).getTime();
    const endAt = new Date(occurrence.endAt).getTime();
    let columnIndex = columns.findIndex((column) => column.endAt <= startAt);

    if (columnIndex === -1) {
      columns.push({ key: occurrence.occurrenceRef, endAt });
      columnIndex = columns.length - 1;
    } else {
      columns[columnIndex] = { key: occurrence.occurrenceRef, endAt };
    }

    const activeKeys = columns
      .filter((column) => column.endAt > startAt)
      .map((column) => column.key);
    const totalColumns = Math.max(activeKeys.length, columnIndex + 1);

    layout.set(occurrence.occurrenceRef, {
      occurrenceRef: occurrence.occurrenceRef,
      column: columnIndex,
      totalColumns,
    });

    for (const activeKey of activeKeys) {
      const current = layout.get(activeKey);
      if (!current) continue;
      layout.set(activeKey, {
        ...current,
        totalColumns: Math.max(current.totalColumns, totalColumns),
      });
    }
  }

  return Object.fromEntries(layout.entries());
}
