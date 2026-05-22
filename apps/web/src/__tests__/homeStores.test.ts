import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  });
  useAdjustmentBannerStore.setState({ dismissedByAdjustmentId: {} });
  useRecommendationDraftStore.setState({ draftsByRecommendationId: {} });
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
