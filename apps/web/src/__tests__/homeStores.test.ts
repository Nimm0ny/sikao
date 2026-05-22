import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { updateProfileInfoMock } = vi.hoisted(() => ({
  updateProfileInfoMock: vi.fn(),
}));

vi.mock('@sikao/api-client/profileQueries', () => ({
  updateProfileInfo: updateProfileInfoMock,
}));

import { useAdjustmentBannerStore } from '@sikao/domain/dashboard/useAdjustmentBannerStore';
import { useDashboardPreferenceStore } from '@sikao/domain/dashboard/useDashboardPreferenceStore';
import { useRecommendationDraftStore } from '@sikao/domain/dashboard/useRecommendationDraftStore';
import { usePlanStore } from '@sikao/domain/plan/usePlanStore';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  updateProfileInfoMock.mockReset();
  usePlanStore.setState({
    currentPlanId: null,
    currentView: 'week',
    currentDate: '2026-05-22',
    selectedRange: null,
    optimisticEvents: new Map(),
  });
  useDashboardPreferenceStore.setState({
    preferences: {},
    profileLoaded: false,
    isPersisting: false,
    lastPersistedAt: null,
    lastPersistError: null,
  });
  useAdjustmentBannerStore.setState({ dismissedByAdjustmentId: {} });
  useRecommendationDraftStore.setState({ draftsByRecommendationId: {} });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('home runtime stores', () => {
  it('tracks optimistic plan events in a map-backed store', () => {
    const store = usePlanStore.getState();
    store.setCurrentPlanId(11);
    store.upsertOptimisticEvent('11:2026-05-22', { title: 'Draft event' });
    store.upsertOptimisticEvent('11:2026-05-22', { status: 'planned' });

    expect(usePlanStore.getState().currentPlanId).toBe(11);
    expect(usePlanStore.getState().optimisticEvents.get('11:2026-05-22')).toEqual({
      title: 'Draft event',
      status: 'planned',
    });

    store.removeOptimisticEvent('11:2026-05-22');
    expect(usePlanStore.getState().optimisticEvents.size).toBe(0);
  });

  it('uses local fallback only before profile info is bootstrapped', async () => {
    const store = useDashboardPreferenceStore.getState();
    updateProfileInfoMock.mockResolvedValue({
      dashboardPreferences: { focusMode: 'deep' },
    });

    store.patchPreferences({ focusMode: 'light' });
    expect(localStorage.getItem('sikao.home.dashboard-preferences')).toContain('focusMode');
    expect(updateProfileInfoMock).not.toHaveBeenCalled();

    store.bootstrapFromProfileInfo({
      dashboardPreferences: { focusMode: 'deep' },
    });
    expect(useDashboardPreferenceStore.getState().preferences).toEqual({
      focusMode: 'deep',
    });

    useDashboardPreferenceStore.getState().patchPreferences({ density: 'compact' });
    await useDashboardPreferenceStore.getState().flushPersist();
    expect(updateProfileInfoMock).toHaveBeenCalledWith({
      dashboardPreferences: {
        focusMode: 'deep',
        density: 'compact',
      },
    });
  });

  it('propagates flushPersist failures without faking lastPersistedAt', async () => {
    const store = useDashboardPreferenceStore.getState();
    const error = new Error('persist failed');
    updateProfileInfoMock.mockRejectedValueOnce(error);

    store.bootstrapFromProfileInfo({
      dashboardPreferences: { focusMode: 'deep' },
    });
    const previousPersistedAt = useDashboardPreferenceStore.getState().lastPersistedAt;

    await expect(store.flushPersist()).rejects.toThrow('persist failed');

    expect(useDashboardPreferenceStore.getState().isPersisting).toBe(false);
    expect(useDashboardPreferenceStore.getState().lastPersistedAt).toBe(previousPersistedAt);
    expect(useDashboardPreferenceStore.getState().lastPersistError).toContain('persist failed');
  });

  it('keeps debounced persist failures observable without updating lastPersistedAt', async () => {
    vi.useFakeTimers();
    const store = useDashboardPreferenceStore.getState();
    const error = new Error('debounced persist failed');
    updateProfileInfoMock.mockRejectedValueOnce(error);

    store.bootstrapFromProfileInfo({
      dashboardPreferences: { focusMode: 'deep' },
    });
    const previousPersistedAt = useDashboardPreferenceStore.getState().lastPersistedAt;

    const pendingPersist = store.patchPreferences({ density: 'compact' });
    await vi.advanceTimersByTimeAsync(500);
    await expect(pendingPersist).rejects.toThrow('debounced persist failed');

    expect(updateProfileInfoMock).toHaveBeenCalledWith({
      dashboardPreferences: {
        focusMode: 'deep',
        density: 'compact',
      },
    });
    expect(useDashboardPreferenceStore.getState().isPersisting).toBe(false);
    expect(useDashboardPreferenceStore.getState().lastPersistedAt).toBe(previousPersistedAt);
    expect(useDashboardPreferenceStore.getState().lastPersistError).toContain(
      'debounced persist failed',
    );
  });

  it('rejects pending debounced persistence when profile bootstrap supersedes it', async () => {
    vi.useFakeTimers();
    const store = useDashboardPreferenceStore.getState();

    store.bootstrapFromProfileInfo({
      dashboardPreferences: { focusMode: 'deep' },
    });

    const pendingPersist = store.patchPreferences({ density: 'compact' });
    store.bootstrapFromProfileInfo({
      dashboardPreferences: { focusMode: 'reset' },
    });

    await expect(pendingPersist).rejects.toThrow(
      'dashboard preference persist canceled by profile bootstrap',
    );
  });

  it('gives each debounced write its own lifecycle when a second patch arrives during the first persist', async () => {
    vi.useFakeTimers();
    const store = useDashboardPreferenceStore.getState();
    const releases: Array<() => void> = [];
    updateProfileInfoMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() =>
            resolve({
              dashboardPreferences: {},
            }),
          );
        }),
    );

    store.bootstrapFromProfileInfo({
      dashboardPreferences: { focusMode: 'deep' },
    });

    const firstPersist = store.patchPreferences({ density: 'compact' });
    await vi.advanceTimersByTimeAsync(500);

    let secondSettled = false;
    const secondPersist = store
      .patchPreferences({ focusMode: 'exam' })
      .then(() => {
        secondSettled = true;
      });

    releases[0]!();
    await Promise.resolve();
    expect(secondSettled).toBe(false);

    await vi.advanceTimersByTimeAsync(500);
    expect(updateProfileInfoMock).toHaveBeenNthCalledWith(2, {
      dashboardPreferences: {
        focusMode: 'exam',
        density: 'compact',
      },
    });
    releases[1]!();

    await expect(firstPersist).resolves.toBeUndefined();
    await expect(secondPersist).resolves.toBeUndefined();
  });

  it('persists dismissed adjustment banners in sessionStorage', () => {
    const store = useAdjustmentBannerStore.getState();
    store.dismiss(101);
    expect(store.isDismissed(101)).toBe(true);

    useAdjustmentBannerStore.setState({ dismissedByAdjustmentId: {} });
    useAdjustmentBannerStore.getState().hydrate();
    expect(useAdjustmentBannerStore.getState().isDismissed(101)).toBe(true);

    useAdjustmentBannerStore.getState().restore(101);
    expect(useAdjustmentBannerStore.getState().isDismissed(101)).toBe(false);
  });

  it('retains recommendation reject drafts across dialog reopen', () => {
    const store = useRecommendationDraftStore.getState();
    store.setDraft(7, {
      reason: 'timing',
      note: 'Need a shorter block first',
    });

    expect(store.getDraft(7)).toEqual({
      reason: 'timing',
      note: 'Need a shorter block first',
    });

    useRecommendationDraftStore.setState({ draftsByRecommendationId: {} });
    useRecommendationDraftStore.getState().hydrate();
    expect(useRecommendationDraftStore.getState().getDraft(7)).toEqual({
      reason: 'timing',
      note: 'Need a shorter block first',
    });

    useRecommendationDraftStore.getState().clearDraft(7);
    expect(useRecommendationDraftStore.getState().getDraft(7)).toBeNull();
  });
});
