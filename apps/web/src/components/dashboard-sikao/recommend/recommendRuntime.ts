import type { RecommendationReadV2 } from '@sikao/api-client/types/home';

export type RecommendationActionType = 'review' | 'continue' | 'rest';

export interface TargetDateOption {
  readonly value: string;
  readonly label: string;
}

export function asRecommendationActionType(
  value: RecommendationReadV2['actionType'],
): RecommendationActionType {
  if (value === 'review' || value === 'continue' || value === 'rest') {
    return value;
  }
  throw new Error(`Unsupported recommendation action type: ${value}`);
}

export function recommendationTone(
  actionType: RecommendationActionType,
): string {
  switch (actionType) {
    case 'review':
      return 'border-accent text-accent';
    case 'continue':
      return 'border-ok text-ok';
    case 'rest':
      return 'border-line-3 text-ink-3';
  }
}

export function recommendationLabel(
  actionType: RecommendationActionType,
): string {
  switch (actionType) {
    case 'review':
      return '复盘';
    case 'continue':
      return '继续';
    case 'rest':
      return '休息';
  }
}

function formatLabel(date: Date, prefix: string): string {
  return `${prefix} · ${formatDate(date).slice(5, 10)}`;
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function monday(date: Date): Date {
  const next = new Date(date);
  const weekday = next.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  next.setDate(next.getDate() + delta);
  return next;
}

export function buildTargetDateOptions(now = new Date()): readonly TargetDateOption[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = monday(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const options: TargetDateOption[] = [
    { value: formatDate(today), label: formatLabel(today, '今天') },
  ];

  if (tomorrow <= weekEnd) {
    options.push({
      value: formatDate(tomorrow),
      label: formatLabel(tomorrow, '明天'),
    });
  }

  for (let cursor = new Date(today); cursor <= weekEnd; cursor.setDate(cursor.getDate() + 1)) {
    const value = formatDate(cursor);
    if (options.some((option) => option.value === value)) continue;
    options.push({
      value,
      label: `本周 · ${value.slice(5)}`,
    });
  }

  return options;
}
