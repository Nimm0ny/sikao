import type { CatalogItemV2, PracticePreferencesResponseV2, PracticeSessionCreateRequestV2 } from '@sikao/api-client/types/practice';

export interface CustomPracticeDraft {
  readonly sourceMode: 'real_exam' | 'ai_generated';
  readonly yearRange: 'all' | 'recent_3' | 'recent_5' | 'recent_10';
  readonly difficultyMin: number;
  readonly difficultyMax: number;
  readonly count: 5 | 10 | 15 | 20 | 30;
  readonly practiceMode: 'per_question' | 'full_set';
  readonly excludeDone: boolean;
  readonly onlyWrong: boolean;
  readonly categoryL1: string;
  readonly categoryL2: string;
}

export function buildDraftFromPreferences(
  response?: Pick<PracticePreferencesResponseV2, 'payload'>,
): CustomPracticeDraft {
  const custom = response?.payload.customPractice;
  return {
    sourceMode: custom?.lastUsedSourceMode ?? 'real_exam',
    yearRange: custom?.lastUsedYearRange ?? 'recent_3',
    difficultyMin: custom?.lastUsedDifficultyRange?.[0] ?? 0,
    difficultyMax: custom?.lastUsedDifficultyRange?.[1] ?? 1,
    count: custom?.lastUsedCount ?? 10,
    practiceMode: custom?.lastUsedPracticeMode ?? 'full_set',
    excludeDone: custom?.lastUsedExcludeDone ?? true,
    onlyWrong: custom?.lastUsedOnlyWrong ?? false,
    categoryL1: '',
    categoryL2: '',
  };
}

export function buildCustomSessionPayload(
  scope: 'xingce' | 'essay',
  draft: CustomPracticeDraft,
): PracticeSessionCreateRequestV2 {
  const config: Record<string, unknown> = {
    count: draft.count,
    year_range: draft.yearRange,
    difficulty_range: [draft.difficultyMin, draft.difficultyMax],
    exclude_done: draft.excludeDone,
    only_wrong: draft.onlyWrong,
  };
  if (draft.categoryL1) config.category_l1 = draft.categoryL1;
  if (draft.categoryL2) config.category_l2 = draft.categoryL2;
  return {
    track: scope,
    entryKind: 'custom',
    mode: 'custom',
    practiceMode: draft.practiceMode,
    config,
  };
}

export function buildCategoryGroups(items: readonly CatalogItemV2[]) {
  const groups = new Map<string, CatalogItemV2[]>();
  for (const item of items) {
    const key = item.categoryL1 ?? 'other';
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }
  return Array.from(groups.entries());
}

export function formatAccuracy(value: number): string {
  return `${Math.round(value * 100)}%`;
}
