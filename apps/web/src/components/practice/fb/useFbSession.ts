import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';
import { nextTickElapsed } from '@sikao/answer-engine/timing';

// SIKAO Phase 3 (2026-05-09): fb session-level UI state + timing hooks.
//
// Extracted from PracticeSession.tsx to keep the view under the file-size limit.
// Concerns:
//   1. useFbUiState - drawer / modal / topbar pause / submitting flags
//   2. useElapsedSeconds - pause-aware elapsed seconds timer
//   3. useFbCurrentVisibleObserver - IO-driven currentVisibleQid tracking
//
// .ts without JSX works with react-refresh/only-export-components.

export interface FbUiState {
  readonly dockOpen: boolean;
  readonly setDockOpen: (v: boolean) => void;
  readonly exitOpen: boolean;
  readonly setExitOpen: (v: boolean) => void;
  readonly noteQuestionId: string | null;
  readonly setNoteQuestionId: (v: string | null) => void;
  readonly settingsOpen: boolean;
  readonly setSettingsOpen: (v: boolean) => void;
  readonly mobileScratchOpen: boolean;
  readonly setMobileScratchOpen: (v: boolean) => void;
  readonly isPaused: boolean;
  readonly setIsPaused: (v: boolean) => void;
  /**
   * P6 keyboard dispatcher 接 Space 用. functional toggle 比 caller 自行
   * 维护 `!isPaused` 更稳 — keydown handler 在 effect 闭包里读 isPaused
   * 容易 stale, 走 setter functional update 避免漏更新.
   */
  readonly togglePause: () => void;
  readonly isSubmitting: boolean;
  readonly setIsSubmitting: (v: boolean) => void;
}

export function useFbUiState(): FbUiState {
  const [dockOpen, setDockOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [noteQuestionId, setNoteQuestionId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileScratchOpen, setMobileScratchOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const togglePause = useCallback(() => setIsPaused((p) => !p), []);
  return {
    dockOpen,
    setDockOpen,
    exitOpen,
    setExitOpen,
    noteQuestionId,
    setNoteQuestionId,
    settingsOpen,
    setSettingsOpen,
    mobileScratchOpen,
    setMobileScratchOpen,
    isPaused,
    setIsPaused,
    togglePause,
    isSubmitting,
    setIsSubmitting,
  };
}

// R2.3 (2026-05-13): tick 累加纯逻辑 (nextTickElapsed) 抽到
// @sikao/answer-engine/timing (ADR-0002). 这里只剩 React useEffect 包装.
export function useElapsedSeconds(isPaused: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (isPaused) return undefined;
    const id = window.setInterval(() => setElapsed((e) => nextTickElapsed(e, false)), 1000);
    return () => window.clearInterval(id);
  }, [isPaused]);
  return elapsed;
}

export interface FlatQuestion {
  readonly question: QuestionDetailV2;
  readonly displayNo: number;
  readonly sectionId: string;
  readonly sectionTitle: string;
}

export interface UseFbCurrentVisibleObserverArgs {
  readonly flatQuestions: readonly FlatQuestion[];
  readonly isPaused: boolean;
  readonly currentQid: string | null;
  readonly getQuestionCardNode: (questionId: string) => HTMLElement | undefined;
  readonly onChange: (questionId: string | null) => void;
}

export function useFbCurrentVisibleObserver({
  flatQuestions,
  isPaused,
  currentQid,
  getQuestionCardNode,
  onChange,
}: UseFbCurrentVisibleObserverArgs): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    // Pause freezes currentVisible so review navigation is not disturbed.
    if (isPaused) return undefined;
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      throw new Error('IntersectionObserver is required for practice visible question tracking.');
    }
    const visibleSet = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const qid = (entry.target as HTMLElement).dataset.questionId;
          if (qid === undefined) {
            throw new Error('Visible observer target is missing data-question-id.');
          }
          if (entry.isIntersecting) visibleSet.add(qid);
          else visibleSet.delete(qid);
        }
        // Use the earliest visible question by display order as current.
        const firstVisible = flatQuestions.find((q) =>
          visibleSet.has(String(q.question.questionId)),
        );
        const next = firstVisible ? String(firstVisible.question.questionId) : null;
        if (next !== null) onChangeRef.current(next);
      },
      {
        // Bias toward the middle band to reduce scroll jitter.
        rootMargin: '-25% 0px -50% 0px',
        threshold: 0,
      },
    );
    for (const flat of flatQuestions) {
      const questionId = String(flat.question.questionId);
      const el = getQuestionCardNode(questionId);
      if (el === undefined) {
        throw new Error(`Question card ${questionId} is not mounted for visible observer.`);
      }
      observer.observe(el);
    }
    // First mount defaults current to Q1.
    if (currentQid === null && flatQuestions.length > 0) {
      onChangeRef.current(String(flatQuestions[0].question.questionId));
    }
    return () => observer.disconnect();
    // Do not restart the observer on currentQid changes; it causes reconnect jitter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatQuestions, getQuestionCardNode, isPaused]);
}
