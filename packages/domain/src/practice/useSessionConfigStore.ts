import { create } from 'zustand';

import {
  CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
  patchCustomPracticePreferences,
} from '@sikao/api-client/queries/practicePreferencesQueries';
import type {
  CustomPracticeDefaults,
  PracticePreferencesResponseV2,
} from '@sikao/api-client/types/practice';

const STORAGE_KEY = 'sikao.practice.session-config';
const PERSIST_DEBOUNCE_MS = 500;

interface SessionConfigState {
  readonly defaults: CustomPracticeDefaults;
  readonly schemaVersion: number;
  readonly profileLoaded: boolean;
  readonly writeRevision: number;
  readonly isPersisting: boolean;
  readonly lastPersistedAt: number | null;
  readonly lastPersistError: string | null;
  readonly hydrateFromLocalFallback: () => void;
  readonly bootstrapFromPracticePreferences: (
    response: Pick<PracticePreferencesResponseV2, 'schemaVersion' | 'payload'>,
  ) => void;
  readonly replaceDefaults: (defaults: CustomPracticeDefaults) => Promise<void>;
  readonly patchDefaults: (patch: Partial<CustomPracticeDefaults>) => Promise<void>;
  readonly flushPersist: () => Promise<void>;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledDefaults: CustomPracticeDefaults | null = null;
let scheduledPersistTask: Promise<void> | null = null;
let resolveScheduledPersist: (() => void) | null = null;
let rejectScheduledPersist: ((error: unknown) => void) | null = null;

export function buildDefaultCustomPracticeDefaults(): CustomPracticeDefaults {
  return {
    lastUsedSourceMode: 'real_exam',
    lastUsedYearRange: 'recent_3',
    lastUsedDifficultyRange: [0, 1],
    lastUsedCount: 10,
    lastUsedPracticeMode: 'full_set',
    lastUsedExcludeDone: true,
    lastUsedOnlyWrong: false,
  };
}

function readLocalFallback(): CustomPracticeDefaults {
  if (typeof localStorage === 'undefined') return buildDefaultCustomPracticeDefaults();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return buildDefaultCustomPracticeDefaults();
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('session config storage must be an object');
  }
  return {
    ...buildDefaultCustomPracticeDefaults(),
    ...(parsed as Partial<CustomPracticeDefaults>),
  };
}

function writeLocalFallback(defaults: CustomPracticeDefaults): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
}

function clearLocalFallback(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

function clearPersistTimer(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

function cancelScheduledPersist(reason: string): void {
  scheduledDefaults = null;
  clearPersistTimer();
  if (scheduledPersistTask && rejectScheduledPersist) {
    const rejectCurrentPersist = rejectScheduledPersist;
    scheduledPersistTask = null;
    resolveScheduledPersist = null;
    rejectScheduledPersist = null;
    rejectCurrentPersist(new Error(reason));
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

async function commitPersist(
  defaults: CustomPracticeDefaults,
  schemaVersion: number,
  revision: number,
): Promise<void> {
  useSessionConfigStore.setState({ isPersisting: true, lastPersistError: null });
  try {
    const response = await patchCustomPracticePreferences(defaults, schemaVersion);
    const current = useSessionConfigStore.getState();
    if (current.writeRevision !== revision) {
      return;
    }
    useSessionConfigStore.setState({
      schemaVersion: response.schemaVersion,
      isPersisting: false,
      lastPersistedAt: Date.now(),
      lastPersistError: null,
    });
  } catch (error) {
    const current = useSessionConfigStore.getState();
    if (current.writeRevision === revision) {
      useSessionConfigStore.setState({
        isPersisting: false,
        lastPersistError: String(error),
      });
    }
    throw error;
  }
}

async function runScheduledPersist(): Promise<void> {
  const defaults = scheduledDefaults;
  if (!defaults) return;
  const { schemaVersion, writeRevision } = useSessionConfigStore.getState();
  scheduledDefaults = null;
  const resolveCurrentPersist = resolveScheduledPersist;
  const rejectCurrentPersist = rejectScheduledPersist;
  scheduledPersistTask = null;
  resolveScheduledPersist = null;
  rejectScheduledPersist = null;
  try {
    await commitPersist(defaults, schemaVersion, writeRevision);
    resolveCurrentPersist?.();
  } catch (error) {
    rejectCurrentPersist?.(error);
  }
}

function schedulePersist(defaults: CustomPracticeDefaults): Promise<void> {
  scheduledDefaults = defaults;
  clearPersistTimer();
  const pendingTask = ensureScheduledPersistTask();
  persistTimer = setTimeout(() => {
    clearPersistTimer();
    void runScheduledPersist();
  }, PERSIST_DEBOUNCE_MS);
  return pendingTask;
}

function applyWrite(nextDefaults: CustomPracticeDefaults): Promise<void> {
  const { profileLoaded, writeRevision } = useSessionConfigStore.getState();
  useSessionConfigStore.setState({
    defaults: nextDefaults,
    writeRevision: writeRevision + 1,
    isPersisting: profileLoaded,
    lastPersistError: null,
  });
  if (profileLoaded) {
    clearLocalFallback();
    return schedulePersist(nextDefaults);
  }
  writeLocalFallback(nextDefaults);
  return Promise.resolve();
}

export const useSessionConfigStore = create<SessionConfigState>()((set, get) => ({
  defaults: buildDefaultCustomPracticeDefaults(),
  schemaVersion: CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
  profileLoaded: false,
  writeRevision: 0,
  isPersisting: false,
  lastPersistedAt: null,
  lastPersistError: null,
  hydrateFromLocalFallback: () => {
    if (get().profileLoaded) return;
    set({ defaults: readLocalFallback() });
  },
  bootstrapFromPracticePreferences: (response) => {
    cancelScheduledPersist('practice preferences bootstrap canceled scheduled persist');
    clearLocalFallback();
    set({
      defaults: response.payload.customPractice ?? buildDefaultCustomPracticeDefaults(),
      schemaVersion: response.schemaVersion,
      profileLoaded: true,
      writeRevision: get().writeRevision,
      isPersisting: false,
      lastPersistedAt: Date.now(),
      lastPersistError: null,
    });
  },
  replaceDefaults: (defaults) => applyWrite(defaults),
  patchDefaults: (patch) =>
    applyWrite({
      ...get().defaults,
      ...patch,
    }),
  flushPersist: async () => {
    const { defaults, profileLoaded, schemaVersion, writeRevision } = get();
    if (!profileLoaded) {
      writeLocalFallback(defaults);
      return;
    }
    scheduledDefaults = defaults;
    if (persistTimer || scheduledPersistTask) {
      const pendingTask = ensureScheduledPersistTask();
      clearPersistTimer();
      void runScheduledPersist();
      return pendingTask;
    }
    await commitPersist(defaults, schemaVersion, writeRevision);
  },
}));
