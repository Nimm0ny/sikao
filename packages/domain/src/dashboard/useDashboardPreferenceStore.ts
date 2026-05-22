import { create } from 'zustand';

import { updateProfileInfo } from '@sikao/api-client/profileQueries';
import type { ProfileInfoResponseV2 } from '@sikao/api-client/types/home';

const STORAGE_KEY = 'sikao.home.dashboard-preferences';
const PERSIST_DEBOUNCE_MS = 500;

type DashboardPreferences = ProfileInfoResponseV2['dashboardPreferences'];

interface DashboardPreferenceState {
  readonly preferences: DashboardPreferences;
  readonly profileLoaded: boolean;
  readonly isPersisting: boolean;
  readonly lastPersistedAt: number | null;
  readonly bootstrapFromProfileInfo: (profileInfo: Pick<ProfileInfoResponseV2, 'dashboardPreferences'>) => void;
  readonly hydrateFromLocalFallback: () => void;
  readonly replacePreferences: (preferences: DashboardPreferences) => void;
  readonly patchPreferences: (patch: DashboardPreferences) => void;
  readonly flushPersist: () => Promise<void>;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function readLocalFallback(): DashboardPreferences {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('dashboard preference fallback must be an object');
  }
  return parsed as DashboardPreferences;
}

function writeLocalFallback(preferences: DashboardPreferences): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

function clearLocalFallback(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

async function persistPreferences(preferences: DashboardPreferences): Promise<void> {
  await updateProfileInfo({
    dashboardPreferences: preferences,
  });
}

function schedulePersist(preferences: DashboardPreferences): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    void persistPreferences(preferences)
      .then(() => {
        useDashboardPreferenceStore.setState({
          isPersisting: false,
          lastPersistedAt: Date.now(),
        });
      })
      .catch((error) => {
        useDashboardPreferenceStore.setState({ isPersisting: false });
        throw error;
      });
  }, PERSIST_DEBOUNCE_MS);
}

function applyPreferenceWrite(nextPreferences: DashboardPreferences): void {
  const { profileLoaded } = useDashboardPreferenceStore.getState();
  useDashboardPreferenceStore.setState({
    preferences: nextPreferences,
    isPersisting: profileLoaded,
  });
  if (profileLoaded) {
    clearLocalFallback();
    schedulePersist(nextPreferences);
    return;
  }
  writeLocalFallback(nextPreferences);
}

export const useDashboardPreferenceStore = create<DashboardPreferenceState>()((set, get) => ({
  preferences: {},
  profileLoaded: false,
  isPersisting: false,
  lastPersistedAt: null,
  bootstrapFromProfileInfo: (profileInfo) => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    clearLocalFallback();
    set({
      preferences: profileInfo.dashboardPreferences ?? {},
      profileLoaded: true,
      isPersisting: false,
      lastPersistedAt: Date.now(),
    });
  },
  hydrateFromLocalFallback: () => {
    if (get().profileLoaded) return;
    set({ preferences: readLocalFallback() });
  },
  replacePreferences: (preferences) => {
    applyPreferenceWrite(preferences);
  },
  patchPreferences: (patch) => {
    applyPreferenceWrite({
      ...get().preferences,
      ...patch,
    });
  },
  flushPersist: async () => {
    const { preferences, profileLoaded } = get();
    if (!profileLoaded) {
      writeLocalFallback(preferences);
      return;
    }
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    set({ isPersisting: true });
    await persistPreferences(preferences);
    set({ isPersisting: false, lastPersistedAt: Date.now() });
  },
}));
