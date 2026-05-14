import { create } from 'zustand';
import type { PracticeSessionStartV2 } from '@sikao/api-client/types/api';

// SIKAO Phase 3 (2026-05-09): scratch-pad entry and cross-question scratch chip model.
//
// Design SSOT: docs/plan/sikao-xingce-phase3-core.md.
// Scratch chips are session in-memory only for now. They are not persisted across sessions.
// Cross-session persistence and BE /notes integration will be planned separately.
export interface ScratchClip {
  readonly id: string;
  readonly qid: string;
  readonly content: string;
  /** "Q16 数字推理" / "M2 段三" 这类来源标签, 没就 undefined. */
  readonly sourceLabel?: string;
  readonly createdAt: number;
}

interface PracticeState {
  sessionData: PracticeSessionStartV2 | null;
  answers: Record<string, string[]>;
  flaggedQuestions: Set<string>;
  // SIKAO Phase 3: 跨题 scratch chips (note: 不跟题级 NoteEditor 混淆).
  scratchClips: readonly ScratchClip[];
  // 当前题 id / 有限窗口 focus rail / dock selection.
  currentVisibleQuestionId: string | null;
  initSession: (data: PracticeSessionStartV2) => void;
  updateAnswer: (questionId: string, answer: string[]) => void;
  getAnswer: (questionId: string) => string[];
  toggleFlag: (questionId: string) => void;
  setFlags: (questionIds: string[], flagged: boolean) => void;
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

export const usePracticeStore = create<PracticeState>((set, get) => ({
  sessionData: null,
  answers: {},
  flaggedQuestions: new Set<string>(),
  scratchClips: [],
  currentVisibleQuestionId: null,
  initSession: (data) => {
    // Freeze large data to prevent overhead
    const frozenData = Object.freeze(data);
    set({
      sessionData: frozenData,
      answers: { ...data.savedAnswers },
      flaggedQuestions: new Set<string>(),
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
  getAnswer: (questionId) => {
    return get().answers[questionId] || [];
  },
  toggleFlag: (questionId) => {
    set((state) => {
      const next = new Set(state.flaggedQuestions);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return { flaggedQuestions: next };
    });
  },
  setFlags: (questionIds: string[], flagged: boolean) => {
    set((state) => {
      const next = new Set(state.flaggedQuestions);
      for (const qid of questionIds) {
        if (flagged) {
          next.add(qid);
        } else {
          next.delete(qid);
        }
      }
      return { flaggedQuestions: next };
    });
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
      answers: {},
      flaggedQuestions: new Set<string>(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
  },
}));
