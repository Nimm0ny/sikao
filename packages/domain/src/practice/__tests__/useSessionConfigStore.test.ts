import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionConfigStore } from '../useSessionConfigStore';
import { patchCustomPracticePreferences } from '@sikao/api-client/queries/practicePreferencesQueries';

vi.mock('@sikao/api-client/queries/practicePreferencesQueries', async () => {
  const actual = await vi.importActual<
    typeof import('@sikao/api-client/queries/practicePreferencesQueries')
  >('@sikao/api-client/queries/practicePreferencesQueries');
  return {
    ...actual,
    patchCustomPracticePreferences: vi.fn(),
  };
});

describe('practice/useSessionConfigStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    useSessionConfigStore.setState({
      defaults: {
        lastUsedSourceMode: 'real_exam',
        lastUsedYearRange: 'recent_3',
        lastUsedDifficultyRange: [0, 1],
        lastUsedCount: 10,
        lastUsedPracticeMode: 'full_set',
        lastUsedExcludeDone: true,
        lastUsedOnlyWrong: false,
      },
      schemaVersion: 1,
      profileLoaded: false,
      writeRevision: 0,
      isPersisting: false,
      lastPersistedAt: null,
      lastPersistError: null,
    });
    vi.mocked(patchCustomPracticePreferences).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes local fallback before profile bootstrap', async () => {
    await useSessionConfigStore.getState().patchDefaults({ lastUsedCount: 30 });

    expect(JSON.parse(localStorage.getItem('sikao.practice.session-config') ?? '{}')).toMatchObject({
      lastUsedCount: 30,
    });
    expect(vi.mocked(patchCustomPracticePreferences)).not.toHaveBeenCalled();
  });

  it('switches async sync target to practice_preferences customPractice PATCH after bootstrap', async () => {
    vi.mocked(patchCustomPracticePreferences).mockResolvedValue({
      payload: {
        customPractice: {
          lastUsedSourceMode: 'real_exam',
          lastUsedYearRange: 'recent_10',
          lastUsedDifficultyRange: [0, 1],
          lastUsedCount: 15,
          lastUsedPracticeMode: 'full_set',
          lastUsedExcludeDone: true,
          lastUsedOnlyWrong: false,
        },
      },
      schemaVersion: 1,
      updatedAt: '2026-05-24T00:00:00Z',
    });

    useSessionConfigStore.getState().bootstrapFromPracticePreferences({
      schemaVersion: 1,
      payload: {
        customPractice: {
          lastUsedSourceMode: 'real_exam',
          lastUsedYearRange: 'recent_3',
          lastUsedDifficultyRange: [0, 1],
          lastUsedCount: 10,
          lastUsedPracticeMode: 'full_set',
          lastUsedExcludeDone: true,
          lastUsedOnlyWrong: false,
        },
      },
    });

    const pending = useSessionConfigStore.getState().patchDefaults({
      lastUsedCount: 15,
      lastUsedYearRange: 'recent_10',
    });

    await vi.advanceTimersByTimeAsync(500);
    await pending;

    expect(vi.mocked(patchCustomPracticePreferences)).toHaveBeenCalledWith(
      expect.objectContaining({
        lastUsedCount: 15,
        lastUsedYearRange: 'recent_10',
      }),
      1,
    );
    expect(useSessionConfigStore.getState().lastPersistError).toBeNull();
  });

  it('does not let an older PATCH response roll back a newer edit', async () => {
    type PatchResponse = Awaited<ReturnType<typeof patchCustomPracticePreferences>>;
    let resolveFirstResponse: ((value: PatchResponse) => void) | null = null;
    let resolveSecondResponse: ((value: PatchResponse) => void) | null = null;
    vi.mocked(patchCustomPracticePreferences)
      .mockImplementationOnce(
        () =>
          new Promise<PatchResponse>((resolve) => {
            resolveFirstResponse = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<PatchResponse>((resolve) => {
            resolveSecondResponse = resolve;
          }),
      );

    useSessionConfigStore.getState().bootstrapFromPracticePreferences({
      schemaVersion: 1,
      payload: {
        customPractice: {
          lastUsedSourceMode: 'real_exam',
          lastUsedYearRange: 'recent_3',
          lastUsedDifficultyRange: [0, 1],
          lastUsedCount: 10,
          lastUsedPracticeMode: 'full_set',
          lastUsedExcludeDone: true,
          lastUsedOnlyWrong: false,
        },
      },
    });

    const first = useSessionConfigStore.getState().patchDefaults({ lastUsedCount: 15 });
    await vi.advanceTimersByTimeAsync(500);
    const second = useSessionConfigStore.getState().patchDefaults({ lastUsedCount: 20 });
    await vi.advanceTimersByTimeAsync(500);

    resolveFirstResponse!({
      payload: {
        customPractice: {
          lastUsedSourceMode: 'real_exam',
          lastUsedYearRange: 'recent_3',
          lastUsedDifficultyRange: [0, 1],
          lastUsedCount: 15,
          lastUsedPracticeMode: 'full_set',
          lastUsedExcludeDone: true,
          lastUsedOnlyWrong: false,
        },
      },
      schemaVersion: 1,
      updatedAt: '2026-05-24T00:00:01Z',
    });
    await first;
    expect(useSessionConfigStore.getState().defaults.lastUsedCount).toBe(20);

    resolveSecondResponse!({
      payload: {
        customPractice: {
          lastUsedSourceMode: 'real_exam',
          lastUsedYearRange: 'recent_3',
          lastUsedDifficultyRange: [0, 1],
          lastUsedCount: 20,
          lastUsedPracticeMode: 'full_set',
          lastUsedExcludeDone: true,
          lastUsedOnlyWrong: false,
        },
      },
      schemaVersion: 1,
      updatedAt: '2026-05-24T00:00:02Z',
    });
    await second;
    expect(useSessionConfigStore.getState().defaults.lastUsedCount).toBe(20);
    expect(useSessionConfigStore.getState().isPersisting).toBe(false);
  });
});
