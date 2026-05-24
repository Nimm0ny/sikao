import { create } from 'zustand';
import type { PracticeSessionStartV2 } from '@sikao/api-client/types/api';
import type {
  MockExamCountdownResponseV2,
  PracticeSessionEnvelopeV2,
  SessionLifecycleResponseV2,
  TimingEventV2,
} from '@sikao/api-client/types/practice';

export interface ScratchClip {
  readonly id: string;
  readonly qid: string;
  readonly content: string;
  readonly sourceLabel?: string;
  readonly createdAt: number;
}

type PracticeSessionItem = PracticeSessionEnvelopeV2['items'][number];

function toNumericStoreId(value: number | string, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

interface PracticeState {
  sessionData: PracticeSessionStartV2 | null;
  sessionEnvelope: PracticeSessionEnvelopeV2 | null;
  sessionLifecycle: SessionLifecycleResponseV2 | null;
  mockExamCountdown: MockExamCountdownResponseV2 | null;
  currentStudyTaskId: number | null;
  answers: Record<string, string[]>;
  flaggedQuestions: Set<number>;
  favoritedQuestions: Set<number>;
  persistentFlaggedQuestions: Set<number>;
  viewedSolutionAnswerIds: Set<number>;
  noteDrafts: Record<string, string>;
  pendingTimingEvents: readonly TimingEventV2[];
  scratchClips: readonly ScratchClip[];
  currentVisibleQuestionId: string | null;
  initSession: (
    data: PracticeSessionStartV2,
    options?: { studyTaskId?: number | null },
  ) => void;
  bootstrapSessionEnvelope: (session: PracticeSessionEnvelopeV2) => void;
  updateAnswer: (questionId: string, answer: string[]) => void;
  getAnswer: (questionId: string) => string[];
  toggleFlag: (questionId: number | string) => void;
  setFlags: (questionIds: readonly (number | string)[], flagged: boolean) => void;
  setQuestionFavorited: (questionId: number | string, favorited: boolean) => void;
  setPersistentFlag: (questionId: number | string, flagged: boolean) => void;
  markViewedSolution: (answerId: number | string, viewed?: boolean) => void;
  setNoteDraft: (questionId: string, draft: string) => void;
  clearNoteDraft: (questionId: string) => void;
  setSessionLifecycle: (lifecycle: SessionLifecycleResponseV2 | null) => void;
  setMockExamCountdown: (countdown: MockExamCountdownResponseV2 | null) => void;
  enqueueTimingEvents: (events: readonly TimingEventV2[]) => void;
  drainTimingEvents: () => readonly TimingEventV2[];
  addScratchClip: (input: { qid: string; content: string; sourceLabel?: string }) => void;
  removeScratchClip: (id: string) => void;
  setCurrentVisibleQuestionId: (questionId: string | null) => void;
  clearSession: () => void;
}

let CLIP_SEQ = 0;

function nextClipId(): string {
  CLIP_SEQ += 1;
  return `clip-${Date.now().toString(36)}-${CLIP_SEQ.toString(36)}`;
}

function buildNumericQuestionKeySet(
  items: readonly PracticeSessionItem[],
  selector: (item: PracticeSessionItem) => boolean,
): Set<number> {
  return new Set(items.filter(selector).map((item) => toNumericStoreId(item.questionKey, 'questionKey')));
}

function buildViewedSolutionSet(items: readonly PracticeSessionItem[]): Set<number> {
  return new Set(items.filter((item) => item.viewedSolution).map((item) => toNumericStoreId(item.id, 'answerId')));
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  sessionData: null,
  sessionEnvelope: null,
  sessionLifecycle: null,
  mockExamCountdown: null,
  currentStudyTaskId: null,
  answers: {},
  flaggedQuestions: new Set<number>(),
  favoritedQuestions: new Set<number>(),
  persistentFlaggedQuestions: new Set<number>(),
  viewedSolutionAnswerIds: new Set<number>(),
  noteDrafts: {},
  pendingTimingEvents: [],
  scratchClips: [],
  currentVisibleQuestionId: null,
  initSession: (data, options) => {
    const frozenData = Object.freeze(data);
    set({
      sessionData: frozenData,
      sessionEnvelope: null,
      sessionLifecycle: null,
      mockExamCountdown: null,
      currentStudyTaskId: options?.studyTaskId ?? null,
      answers: { ...data.savedAnswers },
      flaggedQuestions: new Set<number>(),
      favoritedQuestions: new Set<number>(),
      persistentFlaggedQuestions: new Set<number>(),
      viewedSolutionAnswerIds: new Set<number>(),
      noteDrafts: {},
      pendingTimingEvents: [],
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
  },
  bootstrapSessionEnvelope: (session) => {
    set({
      sessionData: null,
      sessionEnvelope: Object.freeze(session),
      sessionLifecycle: null,
      mockExamCountdown: null,
      currentStudyTaskId: null,
      answers: {},
      flaggedQuestions: buildNumericQuestionKeySet(session.items, (item) => item.flagged),
      favoritedQuestions: buildNumericQuestionKeySet(session.items, (item) => item.isFavorited),
      persistentFlaggedQuestions: buildNumericQuestionKeySet(session.items, (item) => item.hasPersistentFlag),
      viewedSolutionAnswerIds: buildViewedSolutionSet(session.items),
      noteDrafts: {},
      pendingTimingEvents: [],
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
  },
  updateAnswer: (questionId, answer) => {
    set((state) => ({
      answers: {
        ...state.answers,
        [questionId]: answer,
      },
    }));
  },
  getAnswer: (questionId) => get().answers[questionId] || [],
  toggleFlag: (questionId) => {
    const numericQuestionId = toNumericStoreId(questionId, 'questionId');
    set((state) => {
      const next = new Set(state.flaggedQuestions);
      if (next.has(numericQuestionId)) {
        next.delete(numericQuestionId);
      } else {
        next.add(numericQuestionId);
      }
      return { flaggedQuestions: next };
    });
  },
  setFlags: (questionIds, flagged) => {
    set((state) => {
      const next = new Set(state.flaggedQuestions);
      for (const qid of questionIds) {
        const numericQuestionId = toNumericStoreId(qid, 'questionId');
        if (flagged) {
          next.add(numericQuestionId);
        } else {
          next.delete(numericQuestionId);
        }
      }
      return { flaggedQuestions: next };
    });
  },
  setQuestionFavorited: (questionId, favorited) => {
    const numericQuestionId = toNumericStoreId(questionId, 'questionId');
    set((state) => {
      const next = new Set(state.favoritedQuestions);
      if (favorited) {
        next.add(numericQuestionId);
      } else {
        next.delete(numericQuestionId);
      }
      return { favoritedQuestions: next };
    });
  },
  setPersistentFlag: (questionId, flagged) => {
    const numericQuestionId = toNumericStoreId(questionId, 'questionId');
    set((state) => {
      const next = new Set(state.persistentFlaggedQuestions);
      if (flagged) {
        next.add(numericQuestionId);
      } else {
        next.delete(numericQuestionId);
      }
      return { persistentFlaggedQuestions: next };
    });
  },
  markViewedSolution: (answerId, viewed = true) => {
    const numericAnswerId = toNumericStoreId(answerId, 'answerId');
    set((state) => {
      const next = new Set(state.viewedSolutionAnswerIds);
      if (viewed) {
        next.add(numericAnswerId);
      } else {
        next.delete(numericAnswerId);
      }
      return { viewedSolutionAnswerIds: next };
    });
  },
  setNoteDraft: (questionId, draft) => {
    set((state) => ({
      noteDrafts: {
        ...state.noteDrafts,
        [questionId]: draft,
      },
    }));
  },
  clearNoteDraft: (questionId) => {
    set((state) => {
      const next = { ...state.noteDrafts };
      delete next[questionId];
      return { noteDrafts: next };
    });
  },
  setSessionLifecycle: (sessionLifecycle) => {
    set({ sessionLifecycle });
  },
  setMockExamCountdown: (mockExamCountdown) => {
    set({ mockExamCountdown });
  },
  enqueueTimingEvents: (events) => {
    if (events.length === 0) {
      return;
    }
    set((state) => ({
      pendingTimingEvents: [...state.pendingTimingEvents, ...events],
    }));
  },
  drainTimingEvents: () => {
    const events = get().pendingTimingEvents;
    set({ pendingTimingEvents: [] });
    return events;
  },
  addScratchClip: ({ qid, content, sourceLabel }) => {
    const clip: ScratchClip = {
      id: nextClipId(),
      qid,
      content,
      sourceLabel,
      createdAt: Date.now(),
    };
    set((state) => ({ scratchClips: [...state.scratchClips, clip] }));
  },
  removeScratchClip: (id) => {
    set((state) => ({
      scratchClips: state.scratchClips.filter((clip) => clip.id !== id),
    }));
  },
  setCurrentVisibleQuestionId: (questionId) => {
    set({ currentVisibleQuestionId: questionId });
  },
  clearSession: () => {
    set({
      sessionData: null,
      sessionEnvelope: null,
      sessionLifecycle: null,
      mockExamCountdown: null,
      currentStudyTaskId: null,
      answers: {},
      flaggedQuestions: new Set<number>(),
      favoritedQuestions: new Set<number>(),
      persistentFlaggedQuestions: new Set<number>(),
      viewedSolutionAnswerIds: new Set<number>(),
      noteDrafts: {},
      pendingTimingEvents: [],
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
  },
}));
