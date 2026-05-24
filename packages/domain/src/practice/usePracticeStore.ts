import { create } from 'zustand';

const STORAGE_KEY = 'sikao.practice.center-state';

export type PracticeSegment = 'xingce' | 'essay';
export type PracticePaperSort = 'default' | 'recent' | 'year_desc';

export interface PracticePaperFilters {
  readonly year?: number | null;
  readonly region?: string | null;
  readonly examType?: string | null;
  readonly difficultyMin?: number | null;
  readonly difficultyMax?: number | null;
}

interface PracticeCenterState {
  readonly segment: PracticeSegment;
  readonly filtersBySegment: Readonly<Record<PracticeSegment, PracticePaperFilters>>;
  readonly sortBySegment: Readonly<Record<PracticeSegment, PracticePaperSort>>;
  readonly hydrate: () => void;
  readonly setSegment: (segment: PracticeSegment) => void;
  readonly patchFilters: (patch: PracticePaperFilters, segment?: PracticeSegment) => void;
  readonly resetFilters: (segment?: PracticeSegment) => void;
  readonly setSort: (sort: PracticePaperSort, segment?: PracticeSegment) => void;
  readonly getActiveFilters: () => PracticePaperFilters;
  readonly getActiveSort: () => PracticePaperSort;
  readonly clear: () => void;
}

interface StoredPracticeCenterState {
  readonly segment: PracticeSegment;
  readonly filtersBySegment: Readonly<Record<PracticeSegment, PracticePaperFilters>>;
  readonly sortBySegment: Readonly<Record<PracticeSegment, PracticePaperSort>>;
}

const DEFAULT_FILTERS: PracticePaperFilters = {
  year: null,
  region: null,
  examType: null,
  difficultyMin: null,
  difficultyMax: null,
};

const DEFAULT_STATE: StoredPracticeCenterState = {
  segment: 'xingce',
  filtersBySegment: {
    xingce: DEFAULT_FILTERS,
    essay: DEFAULT_FILTERS,
  },
  sortBySegment: {
    xingce: 'default',
    essay: 'default',
  },
};

function readStoredState(): StoredPracticeCenterState {
  if (typeof sessionStorage === 'undefined') return DEFAULT_STATE;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_STATE;
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('practice center storage must be an object');
  }
  return {
    ...DEFAULT_STATE,
    ...(parsed as Partial<StoredPracticeCenterState>),
  };
}

function writeStoredState(next: StoredPracticeCenterState): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export const usePracticeStore = create<PracticeCenterState>()((set, get) => ({
  ...DEFAULT_STATE,
  hydrate: () => {
    set(readStoredState());
  },
  setSegment: (segment) => {
    const next: StoredPracticeCenterState = {
      segment,
      filtersBySegment: get().filtersBySegment,
      sortBySegment: get().sortBySegment,
    };
    writeStoredState(next);
    set({ segment });
  },
  patchFilters: (patch, segment = get().segment) => {
    const next: StoredPracticeCenterState = {
      segment: get().segment,
      filtersBySegment: {
        ...get().filtersBySegment,
        [segment]: {
          ...DEFAULT_FILTERS,
          ...get().filtersBySegment[segment],
          ...patch,
        },
      },
      sortBySegment: get().sortBySegment,
    };
    writeStoredState(next);
    set({ filtersBySegment: next.filtersBySegment });
  },
  resetFilters: (segment = get().segment) => {
    const next: StoredPracticeCenterState = {
      segment: get().segment,
      filtersBySegment: {
        ...get().filtersBySegment,
        [segment]: DEFAULT_FILTERS,
      },
      sortBySegment: get().sortBySegment,
    };
    writeStoredState(next);
    set({ filtersBySegment: next.filtersBySegment });
  },
  setSort: (sort, segment = get().segment) => {
    const next: StoredPracticeCenterState = {
      segment: get().segment,
      filtersBySegment: get().filtersBySegment,
      sortBySegment: {
        ...get().sortBySegment,
        [segment]: sort,
      },
    };
    writeStoredState(next);
    set({ sortBySegment: next.sortBySegment });
  },
  getActiveFilters: () => {
    const state = get();
    return state.filtersBySegment[state.segment];
  },
  getActiveSort: () => {
    const state = get();
    return state.sortBySegment[state.segment];
  },
  clear: () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    set(DEFAULT_STATE);
  },
}));
