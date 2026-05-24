import { describe, expect, it } from 'vitest';

import {
  buildCustomPracticePatchRequest,
  CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
} from '../practicePreferencesQueries';

describe('buildCustomPracticePatchRequest', () => {
  it('flattens customPractice into leaf PATCH operations', () => {
    const payload = buildCustomPracticePatchRequest({
      lastUsedSourceMode: 'ai_generated',
      lastUsedYearRange: 'recent_5',
      lastUsedDifficultyRange: [0.2, 0.9],
      lastUsedCount: 20,
      lastUsedPracticeMode: 'per_question',
      lastUsedExcludeDone: false,
      lastUsedOnlyWrong: true,
    });

    expect(payload.schemaVersion).toBe(CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION);
    expect(payload.patches).toEqual([
      { path: 'customPractice.lastUsedSourceMode', value: 'ai_generated' },
      { path: 'customPractice.lastUsedYearRange', value: 'recent_5' },
      { path: 'customPractice.lastUsedDifficultyRange', value: [0.2, 0.9] },
      { path: 'customPractice.lastUsedCount', value: 20 },
      { path: 'customPractice.lastUsedPracticeMode', value: 'per_question' },
      { path: 'customPractice.lastUsedExcludeDone', value: false },
      { path: 'customPractice.lastUsedOnlyWrong', value: true },
    ]);
  });
});
