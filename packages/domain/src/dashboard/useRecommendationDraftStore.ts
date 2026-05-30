import { create } from 'zustand';

const STORAGE_KEY = 'sikao.home.recommendation-drafts';

export interface RecommendationRejectDraft {
  readonly reason: string;
  readonly note: string | null;
}

type RecommendationDraft = RecommendationRejectDraft;

interface RecommendationDraftStoreState {
  readonly draftsByRecommendationId: Readonly<Record<string, RecommendationDraft>>;
  readonly setDraft: (recommendationId: number | string, draft: RecommendationDraft) => void;
  readonly clearDraft: (recommendationId: number | string) => void;
  readonly getDraft: (recommendationId: number | string) => RecommendationDraft | null;
  readonly hydrate: () => void;
}

function readDrafts(): Record<string, RecommendationDraft> {
  if (typeof sessionStorage === 'undefined') return {};
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('recommendation drafts storage must be an object');
  }
  return parsed as Record<string, RecommendationDraft>;
}

function writeDrafts(next: Record<string, RecommendationDraft>): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export const useRecommendationDraftStore = create<RecommendationDraftStoreState>()((set, get) => ({
  draftsByRecommendationId: {},
  setDraft: (recommendationId, draft) => {
    const next = {
      ...get().draftsByRecommendationId,
      [String(recommendationId)]: draft,
    };
    writeDrafts(next);
    set({ draftsByRecommendationId: next });
  },
  clearDraft: (recommendationId) => {
    const next = { ...get().draftsByRecommendationId };
    delete next[String(recommendationId)];
    writeDrafts(next);
    set({ draftsByRecommendationId: next });
  },
  getDraft: (recommendationId) => {
    return get().draftsByRecommendationId[String(recommendationId)] ?? null;
  },
  hydrate: () => {
    set({ draftsByRecommendationId: readDrafts() });
  },
}));
