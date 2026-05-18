// EssayShellSikao — SIKAO V3 申论考场壳. Sibling of ExamShell.tsx (legacy
// 3-column 田字格 view). Uses the same `useExamSession` store + EssayClient
// submit pipeline so the LLM grading link stays intact. Layout is per spec
// 04-essay.md: double-column 1.1fr / 1fr with MaterialPanel + ScratchPad on
// the left, EditorPanel on the right. 04b adds MmStrip on the source col
// header + question switcher row.
//
// State machine reuses existing phases (prestart / running / paused /
// submitting / submitted) — no new transitions added. Shortcuts kept thin
// (no ⌘\ / ⌘/ panel collapse — spec is single-shape).

import { useEffect, useMemo, useState } from 'react';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { bodyChars } from '@sikao/answer-engine/word-limit/bodyChars';
import { hasReachedMinimum } from '@sikao/answer-engine/word-limit/wordLimits';
import { PrestartModal } from '@sikao/editor/modals/PrestartModal';
import { PausedOverlay } from '@sikao/editor/modals/PausedOverlay';
import { SubmitDialog } from '@sikao/editor/modals/SubmitDialog';
import { EssayGrid } from './EssayGrid';
import { EssayTopbar } from './EssayTopbar';
import { MaterialPanel } from './MaterialPanel';
import { AnswerSheetPanel } from './AnswerSheetPanel';
import { DraftPaperModal } from './DraftPaperModal';
import { MmStrip, type QuestionStripItem } from './MmStrip';

const SAVE_DEBOUNCE_MS = 1500;

interface Props {
  readonly onAutosave?: () => void;
  readonly onSubmit: () => void;
  // 04 vs 04b — spec calls these the same component, the only diff is that
  // 04b renders the MmStrip on the source-col + editor-col headers.
  readonly mode?: 'single-q' | 'multi';
}

export function EssayShellSikao({ onAutosave, onSubmit, mode = 'multi' }: Props) {
  const paper = useExamSession((s) => s.paper);
  const phase = useExamSession((s) => s.phase);
  const currentQ = useExamSession((s) => s.currentQ);
  const setCurrentQ = useExamSession((s) => s.setCurrentQ);
  const matIdx = useExamSession((s) => s.matIdx);
  const textsByQ = useExamSession((s) => s.textsByQ);
  const elapsedByQ = useExamSession((s) => s.elapsedByQ);
  const highlights = useExamSession((s) => s.highlights);
  const scratchClips = useExamSession((s) => s.scratchClips);
  const scratchNotes = useExamSession((s) => s.scratchNotes);
  const scratch = useExamSession((s) => s.scratch);
  const tick = useExamSession((s) => s.tick);
  const togglePause = useExamSession((s) => s.togglePause);
  const markSaved = useExamSession((s) => s.markSaved);

  const [submitDialog, setSubmitDialog] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  // Wave 9 Phase 2a (2026-05-12): mobile (≤768) 单栏切换 — 'editor' 沉浸答题
  // 默认态, 'material' 拉出材料浮层. tablet+ 双栏总同时显, 此 state no-op.
  const [mobileMode, setMobileMode] = useState<'editor' | 'material'>('editor');

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, []);

  // 1Hz tick — reuses existing tick action (still gated by phase=running).
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return;
    const id = window.setInterval(() => tick(), 1000);
    return () => window.clearInterval(id);
  }, [phase, tick]);

  // Autosave debounce — fires on any persistable mutation. SIKAO doesn't
  // currently snapshot scratchClips / scratchNotes / citationsByQ (post-MVP)
  // but textsByQ / scratch / highlights still flow through onAutosave.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return;
    if (!paper) return;
    const id = window.setTimeout(() => {
      onAutosave?.();
      markSaved();
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [
    phase,
    paper,
    textsByQ,
    scratch,
    highlights,
    scratchClips,
    scratchNotes,
    onAutosave,
    markSaved,
  ]);

  const questionItems = useMemo<QuestionStripItem[]>(() => {
    if (!paper) return [];
    return paper.questions.map((q, i) => {
      const text = textsByQ[i] ?? '';
      const written = bodyChars(text);
      const required = q.maxWords ?? q.minWords ?? 0;
      const done = hasReachedMinimum(q, written);
      const status: QuestionStripItem['status'] = done
        ? 'submitted'
        : written > 0
          ? 'writing'
          : 'pending';
      return {
        id: q.no,
        status,
        currentChars: written,
        requiredChars: required,
      };
    });
  }, [paper, textsByQ]);

  if (!paper) return null;
  const currentQuestion = paper.questions[currentQ];
  const currentMaterial = paper.materials[matIdx];
  const currentText = textsByQ[currentQ] ?? '';
  const currentWritten = bodyChars(currentText);
  const currentRemaining = currentQuestion.durationSec - (elapsedByQ[currentQ] ?? 0);

  const showMmStrip = mode === 'multi' && (paper.materials.length > 1 || paper.questions.length > 1);

  const sourceCol = (
    <MaterialPanel
      material={currentMaterial}
      matIndex={matIdx}
      highlights={highlights[currentMaterial.id] ?? []}
    />
  );

  const editorCol = (
    <>
      {showMmStrip ? (
        <MmStrip
          side="r"
          questions={questionItems}
          activeIdx={currentQ}
          onSelect={setCurrentQ}
        />
      ) : null}
      <AnswerSheetPanel />
    </>
  );

  const toggleMark = () => {
    setMarkedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(currentQ)) next.delete(currentQ);
      else next.add(currentQ);
      return next;
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen();
  };

  return (
    <div
      className="essay-prototype-shell w-full h-full flex flex-col overflow-hidden font-sans"
      data-testid="essay-shell-sikao"
      data-mode={mode}
      data-mobile-mode={mobileMode}
    >
      <EssayTopbar
        onSubmit={() => setSubmitDialog(true)}
        onTogglePause={togglePause}
        onOpenDraft={() => setDraftOpen(true)}
        marked={markedQuestions.has(currentQ)}
        onToggleMark={toggleMark}
        onToggleFullscreen={toggleFullscreen}
        mobileMode={mobileMode}
        onToggleMobileMode={() =>
          setMobileMode((m) => (m === 'editor' ? 'material' : 'editor'))
        }
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        <EssayGrid source={sourceCol} editor={editorCol} mobileMode={mobileMode} />
      </div>
      {phase === 'prestart' && (
        <PrestartModal
          question={currentQuestion}
          onStart={() => useExamSession.getState().start()}
          onPreview={() => useExamSession.getState().pause()}
        />
      )}
      {phase === 'paused' && (
        <PausedOverlay
          written={currentWritten}
          remaining={currentRemaining}
          onResume={() => useExamSession.getState().resume()}
        />
      )}
      {submitDialog && (
        <SubmitDialog
          written={currentWritten}
          minWords={currentQuestion.minWords}
          maxWords={currentQuestion.maxWords}
          remaining={currentRemaining}
          unansweredQuestionNumbers={paper.questions
            .map((q, i) => ((textsByQ[i] ?? '').trim().length === 0 ? q.no : null))
            .filter((no): no is string => no !== null)}
          onCancel={() => setSubmitDialog(false)}
          onConfirm={() => {
            setSubmitDialog(false);
            onSubmit();
          }}
        />
      )}
      <DraftPaperModal open={draftOpen} onClose={() => setDraftOpen(false)} />
    </div>
  );
}
