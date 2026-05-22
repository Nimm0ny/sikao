import { create } from 'zustand';

const STORAGE_KEY = 'sikao.home.adjustment-banner';

interface AdjustmentBannerStoreState {
  readonly dismissedByAdjustmentId: Readonly<Record<string, number>>;
  readonly dismiss: (adjustmentId: number | string) => void;
  readonly restore: (adjustmentId: number | string) => void;
  readonly isDismissed: (adjustmentId: number | string) => boolean;
  readonly hydrate: () => void;
}

function readDismissedMap(): Record<string, number> {
  if (typeof sessionStorage === 'undefined') return {};
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('adjustment banner storage must be an object');
  }
  return parsed as Record<string, number>;
}

function writeDismissedMap(next: Record<string, number>): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export const useAdjustmentBannerStore = create<AdjustmentBannerStoreState>()((set, get) => ({
  dismissedByAdjustmentId: {},
  dismiss: (adjustmentId) => {
    const next = {
      ...get().dismissedByAdjustmentId,
      [String(adjustmentId)]: Date.now(),
    };
    writeDismissedMap(next);
    set({ dismissedByAdjustmentId: next });
  },
  restore: (adjustmentId) => {
    const next = { ...get().dismissedByAdjustmentId };
    delete next[String(adjustmentId)];
    writeDismissedMap(next);
    set({ dismissedByAdjustmentId: next });
  },
  isDismissed: (adjustmentId) => {
    return String(adjustmentId) in get().dismissedByAdjustmentId;
  },
  hydrate: () => {
    set({ dismissedByAdjustmentId: readDismissedMap() });
  },
}));
