import { create } from 'zustand';

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

export type PlanCalendarView = 'week' | 'month';

export interface SelectedDateRange {
  readonly from: string;
  readonly to: string;
}

type OptimisticEventPatch = Partial<PlanEventReadV2>;

interface PlanStoreState {
  readonly currentPlanId: number | null;
  readonly currentView: PlanCalendarView;
  readonly currentDate: string;
  readonly selectedRange: SelectedDateRange | null;
  readonly optimisticEvents: ReadonlyMap<string, OptimisticEventPatch>;
  readonly setCurrentPlanId: (planId: number | null) => void;
  readonly setCurrentView: (view: PlanCalendarView) => void;
  readonly setCurrentDate: (date: string) => void;
  readonly setSelectedRange: (range: SelectedDateRange | null) => void;
  readonly upsertOptimisticEvent: (eventId: string, patch: OptimisticEventPatch) => void;
  readonly removeOptimisticEvent: (eventId: string) => void;
  readonly resetOptimisticEvents: () => void;
}

function cloneOptimisticEvents(
  source: ReadonlyMap<string, OptimisticEventPatch>,
): Map<string, OptimisticEventPatch> {
  return new Map(source.entries());
}

function todayStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const usePlanStore = create<PlanStoreState>()((set) => ({
  currentPlanId: null,
  currentView: 'week',
  currentDate: todayStamp(),
  selectedRange: null,
  optimisticEvents: new Map<string, OptimisticEventPatch>(),
  setCurrentPlanId: (currentPlanId) => set({ currentPlanId }),
  setCurrentView: (currentView) => set({ currentView }),
  setCurrentDate: (currentDate) => set({ currentDate }),
  setSelectedRange: (selectedRange) => set({ selectedRange }),
  upsertOptimisticEvent: (eventId, patch) =>
    set((state) => {
      const optimisticEvents = cloneOptimisticEvents(state.optimisticEvents);
      optimisticEvents.set(eventId, {
        ...(optimisticEvents.get(eventId) ?? {}),
        ...patch,
      });
      return { optimisticEvents };
    }),
  removeOptimisticEvent: (eventId) =>
    set((state) => {
      const optimisticEvents = cloneOptimisticEvents(state.optimisticEvents);
      optimisticEvents.delete(eventId);
      return { optimisticEvents };
    }),
  resetOptimisticEvents: () => set({ optimisticEvents: new Map<string, OptimisticEventPatch>() }),
}));
