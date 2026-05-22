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
  readonly lastPersistError: string | null;
  readonly bootstrapFromProfileInfo: (profileInfo: Pick<ProfileInfoResponseV2, 'dashboardPreferences'>) => void;
  readonly hydrateFromLocalFallback: () => void;
  readonly replacePreferences: (preferences: DashboardPreferences) => Promise<void>;
  readonly patchPreferences: (patch: DashboardPreferences) => Promise<void>;
  readonly flushPersist: () => Promise<void>;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledPreferences: DashboardPreferences | null = null;
let scheduledPersistTask: Promise<void> | null = null;
let resolveScheduledPersist: (() => void) | null = null;
let rejectScheduledPersist: ((error: unknown) => void) | null = null;

function cancelScheduledPersist(reason: string): void {
  scheduledPreferences = null;
  clearPersistTimer();
  if (scheduledPersistTask && rejectScheduledPersist) {
    const rejectCurrentPersist = rejectScheduledPersist;
    scheduledPersistTask = null;
    resolveScheduledPersist = null;
    rejectScheduledPersist = null;
    rejectCurrentPersist(new Error(reason));
  }
}

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

function clearPersistTimer(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

function ensureScheduledPersistTask(): Promise<void> {
  if (scheduledPersistTask) return scheduledPersistTask;
  let resolveCurrentPersist: (() => void) | null = null;
  let rejectCurrentPersist: ((error: unknown) => void) | null = null;
  const task = new Promise<void>((resolve, reject) => {
    resolveScheduledPersist = resolve;
    rejectScheduledPersist = reject;
    resolveCurrentPersist = resolve;
    rejectCurrentPersist = reject;
  });
  scheduledPersistTask = task.finally(() => {
    if (scheduledPersistTask === task) {
      scheduledPersistTask = null;
    }
    if (resolveScheduledPersist === resolveCurrentPersist) {
      resolveScheduledPersist = null;
    }
    if (rejectScheduledPersist === rejectCurrentPersist) {
      rejectScheduledPersist = null;
    }
  });
  void scheduledPersistTask.catch(() => {});
  return scheduledPersistTask;
}

async function commitPersist(preferences: DashboardPreferences): Promise<void> {
  useDashboardPreferenceStore.setState({ isPersisting: true, lastPersistError: null });
  try {
    await persistPreferences(preferences);
    useDashboardPreferenceStore.setState({
      isPersisting: false,
      lastPersistedAt: Date.now(),
      lastPersistError: null,
    });
  } catch (error) {
    useDashboardPreferenceStore.setState({
      isPersisting: false,
      lastPersistError: String(error),
    });
    throw error;
  }
}

async function runScheduledPersist(): Promise<void> {
  const preferences = scheduledPreferences;
  if (!preferences) return;

  scheduledPreferences = null;
  const resolveCurrentPersist = resolveScheduledPersist;
  const rejectCurrentPersist = rejectScheduledPersist;
  scheduledPersistTask = null;
  resolveScheduledPersist = null;
  rejectScheduledPersist = null;

  try {
    await commitPersist(preferences);
    resolveCurrentPersist?.();
  } catch (error) {
    rejectCurrentPersist?.(error);
  }
}

function schedulePersist(preferences: DashboardPreferences): Promise<void> {
  scheduledPreferences = preferences;
  clearPersistTimer();
  const pendingTask = ensureScheduledPersistTask();
  persistTimer = setTimeout(() => {
    clearPersistTimer();
    void runScheduledPersist();
  }, PERSIST_DEBOUNCE_MS);
  return pendingTask;
}

function applyPreferenceWrite(nextPreferences: DashboardPreferences): Promise<void> {
  const { profileLoaded } = useDashboardPreferenceStore.getState();
  useDashboardPreferenceStore.setState({
    preferences: nextPreferences,
    isPersisting: profileLoaded,
    lastPersistError: null,
  });
  if (profileLoaded) {
    clearLocalFallback();
    return schedulePersist(nextPreferences);
  }
  writeLocalFallback(nextPreferences);
  return Promise.resolve();
}

export const useDashboardPreferenceStore = create<DashboardPreferenceState>()((set, get) => ({
  preferences: {},
  profileLoaded: false,
  isPersisting: false,
  lastPersistedAt: null,
  lastPersistError: null,
  bootstrapFromProfileInfo: (profileInfo) => {
    cancelScheduledPersist('dashboard preference persist canceled by profile bootstrap');
    clearLocalFallback();
    set({
      preferences: profileInfo.dashboardPreferences ?? {},
      profileLoaded: true,
      isPersisting: false,
      lastPersistedAt: Date.now(),
      lastPersistError: null,
    });
  },
  hydrateFromLocalFallback: () => {
    if (get().profileLoaded) return;
    set({ preferences: readLocalFallback() });
  },
  replacePreferences: (preferences) => {
    return applyPreferenceWrite(preferences);
  },
  patchPreferences: (patch) => {
    return applyPreferenceWrite({
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
    scheduledPreferences = preferences;
    if (persistTimer || scheduledPersistTask) {
      const pendingTask = ensureScheduledPersistTask();
      clearPersistTimer();
      void runScheduledPersist();
      return pendingTask;
    }
    await commitPersist(preferences);
  },
}));
