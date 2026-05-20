import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircleIcon } from '@sikao/ui/icons';
import { Button, EmptyState } from '@sikao/ui/ui';
import { useAsideSet } from '@/layouts/useAsideOutlet';
import { ExitConfirmModal, SessionLoading } from '@/components/practice';
import {
  FbFloatingAnswerDrawer,
  FbMobileScratchSheet,
  FbLayout,
  FbReadingCol,
  FbScratchCol,
  FbScratchFab,
  FbTopbar,
  buildSectionGroups,
  buildSectionItems,
  totalQuestionCount,
  useElapsedSeconds,
  useFbCurrentVisibleObserver,
  useFbKeyboard,
  useFbMobileSwipe,
  useFbUiState,
  useQuestionRegistry,
} from '@/components/practice/fb';
import { SelectionToolbar } from '@/components/practice/fb/SelectionToolbar';
import { useSelectionToolbar } from '@/components/practice/fb/lib/useSelectionToolbar';
import { useHighlightStore } from '@sikao/domain/xingce/useHighlightStore';
import { NoteEditor } from '@/components/practice/NoteEditor';
import { FbSettingsPopover } from '@/components/practice/fb/FbSettingsPopover';
import { useFbSettings } from '@sikao/domain/xingce/useFbSettings';
import { trackEvent } from '@/lib/analytics';
import { fetchQuestionNote, noteKeys } from '@sikao/api-client/apiQueries';
import { usePatchStudyTask } from '@sikao/api-client/queries/studyPlanQueries';
import { useApplyExamTheme } from '@/styles/useThemeStore';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import { api } from '@sikao/api-client/request';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { ERROR_COPY, PRACTICE_COPY } from '@/lib/ui-copy';
import { flushPendingPracticeAnswers } from '@/components/questions/pendingAnswerUpdates';
import type { PracticeSessionStartV2, Section } from '@sikao/api-client/types/api';

// 5 nav (prev/题号/next/答题卡/提交) sticky 底栏; FbDock → FbDrawer 改名.

// 3 秒后还没 sessionData 视作 "会话已失效"(典型场景: 直接打开 URL / 刷新).
const SESSION_TIMEOUT_MS = 3000;

// 默认每题 75s 是公考行测中位 (历史 PracticeShell 经验, 不再展开).
const SECONDS_PER_QUESTION = 75;
function defaultExamSeconds(totalQuestions: number): number {
  const raw = totalQuestions * SECONDS_PER_QUESTION;
  return Math.ceil(raw / 300) * 300;
}

function formatTimerDisplay(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function requirePaperName(paperName: string | null | undefined): string {
  if (paperName === null || paperName === undefined || paperName.trim() === '') {
    throw new Error('Practice session paperName is required.');
  }
  return paperName;
}

/**
 * SPEC §11 第 6 条 (P3a master overrule, 2026-05-11): 交卷前 block 校验.
 *
 * 找到第一道 multi 题且 answers[qid].length < 2 的 question. 返回
 * `{ questionId, displayNo }` 或 null. 用于 toast.warn 文案 + return 阻塞.
 *
 * 命中 displayNo 通过遍历 sections.blocks 累计计算 (跟 buildSectionGroups
 * 同款逻辑). 不复用 buildSectionGroups 是因为它返回 SectionGroup[] 不易抽
 * 单独 question; 这里直接走 sections 一次遍历更简单.
 */
function findMultiChoiceUnderTwo(
  sections: readonly Section[],
  answers: Record<string, string[]>,
): { questionId: string; displayNo: number } | null {
  let displayNo = 0;
  for (const section of sections) {
    for (const block of section.blocks) {
      const questions =
        block.type === 'question' && block.question !== undefined
          ? [block.question]
          : block.type === 'material_group' && block.materialGroup !== undefined
          ? block.materialGroup.questions ?? []
          : [];
      for (const q of questions) {
        displayNo += 1;
        if (q.questionKind === 'multiple_choice') {
          const qid = String(q.questionId);
          const selected = answers[qid] ?? [];
          if (selected.length < 2) {
            return { questionId: qid, displayNo };
          }
        }
      }
    }
  }
  return null;
}

export default function PracticeSession() {
  // 进入考场态应用 examTheme, 离开切回 light.
  useApplyExamTheme();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sessionData = usePracticeStore((state) => state.sessionData);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    if (sessionData !== null) return undefined;
    const tid = window.setTimeout(() => setHasTimedOut(true), SESSION_TIMEOUT_MS);
    return () => window.clearTimeout(tid);
  }, [sessionData]);

  if (!sessionData || sessionId === undefined) {
    if (hasTimedOut) {
      return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto">
          <EmptyState
            tone="error"
            icon={<AlertCircleIcon className="w-8 h-8" />}
            title={ERROR_COPY.session.title}
            description={ERROR_COPY.session.description}
            action={
              <Button
                variant="secondary"
                onClick={() => navigate('/app')}
                data-testid="session-back-home"
              >
                返回题库
              </Button>
            }
          />
        </div>
      );
    }
    return <SessionLoading />;
  }
  return (
    <PracticeSessionBody
      sessionData={sessionData}
      sessionId={sessionId}
      onNavigate={navigate}
    />
  );
}

interface PracticeSessionBodyProps {
  readonly sessionData: PracticeSessionStartV2;
  readonly sessionId: string;
  readonly onNavigate: (to: string) => void;
}

function PracticeSessionBody({
  sessionData,
  sessionId,
  onNavigate,
}: PracticeSessionBodyProps) {
  // fb 答题考场态独立 density 偏好 (cozy / compact). mount apply 到
  // <html data-density>, unmount 不 reset 让 dashboard useTweaks 在下个
  // 路由 mount 时 re-apply 自己的偏好.
  useFbSettings();
  const sectionGroups = useMemo(
    () => buildSectionGroups(sessionData.sections),
    [sessionData.sections],
  );
  // P4/3: sectionItemsGroups 给 FbReadingCol 用 (保留 material_group 元信息);
  // FbDockBody 仍用 sectionGroups (flat, dock grid 不需要 material 信息).
  const sectionItemsGroups = useMemo(
    () => buildSectionItems(sessionData.sections),
    [sessionData.sections],
  );
  const flatQuestions = useMemo(
    () => sectionGroups.flatMap((g) => g.questions),
    [sectionGroups],
  );
  const totalQuestions = useMemo(
    () => totalQuestionCount(sessionData.sections),
    [sessionData.sections],
  );
  const ui = useFbUiState();
  const setNoteQuestionId = ui.setNoteQuestionId;
  const elapsed = useElapsedSeconds(ui.isPaused);
  const timerSeconds = defaultExamSeconds(totalQuestions);
  const remaining = Math.max(0, timerSeconds - elapsed);
  const timerDisplay = formatTimerDisplay(remaining);
  const patchStudyTask = usePatchStudyTask();
  // 答题数 >= 5 时 scratch col fade in (master 渐进披露阈值).
  const answers = usePracticeStore((s) => s.answers);
  const currentStudyTaskId = usePracticeStore((s) => s.currentStudyTaskId);
  const flagged = usePracticeStore((s) => s.flaggedQuestions);
  const scratchClips = usePracticeStore((s) => s.scratchClips);
  const currentVisibleQid = usePracticeStore((s) => s.currentVisibleQuestionId);
  const setCurrentVisibleQid = usePracticeStore(
    (s) => s.setCurrentVisibleQuestionId,
  );
  const addScratchClip = usePracticeStore((s) => s.addScratchClip);
  const removeScratchClip = usePracticeStore((s) => s.removeScratchClip);
  const clearSession = usePracticeStore((s) => s.clearSession);
  const updateAnswer = usePracticeStore((s) => s.updateAnswer);
  const setFlags = usePracticeStore((s) => s.setFlags);
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const questionRegistry = useQuestionRegistry();
  const [passagesCollapsed, setPassagesCollapsed] = useState(false);
  const togglePassagesCollapsed = useCallback(
    () => setPassagesCollapsed((c) => !c),
    [],
  );

  // P5b/3: 划线浮工具条 + armed mode integration.
  // 父级管 armed qid (用作 FbCard armed prop 触 1.2s pulse) + toolbar rect.
  const selectionToolbar = useSelectionToolbar();

  const currentVisible = useMemo(() => {
    if (flatQuestions.length === 0) {
      throw new Error('Practice session has no questions.');
    }
    if (currentVisibleQid === null) return flatQuestions[0];
    const found = flatQuestions.find(
      (q) => String(q.question.questionId) === currentVisibleQid,
    );
    if (found === undefined) {
      throw new Error(`Current question ${currentVisibleQid} is not in session.`);
    }
    return found;
  }, [currentVisibleQid, flatQuestions]);
  const currentVisibleLabel = `Q${currentVisible.displayNo} ${currentVisible.sectionTitle}`;
  const currentVisibleQuestionId = String(currentVisible.question.questionId);

  useEffect(() => {
    if (currentVisibleQid !== null) return;
    setCurrentVisibleQid(currentVisibleQuestionId);
  }, [currentVisibleQid, currentVisibleQuestionId, setCurrentVisibleQid]);
  useFbCurrentVisibleObserver({
    flatQuestions,
    isPaused: ui.isPaused,
    currentQid: currentVisibleQid,
    getQuestionCardNode: questionRegistry.getQuestionNode,
    onChange: setCurrentVisibleQid,
  });

  // P6 keyboard dispatcher (统一接管 1-4 / T / F / Space / A / P / Cmd+Z).
  // Esc 各 modal 自管 (master 决策降级方案). P6 在 PracticeSession route 内
  // mount, 不全局 wire (App.tsx 不接).
  const handleOpenDrawer = useCallback(() => ui.setDockOpen(true), [ui]);
  const undoHighlight = useCallback(() => {
    useHighlightStore.getState().undo();
  }, []);
  useFbKeyboard({
    currentQuestion: currentVisible.question,
    answers,
    onAnswer: updateAnswer,
    togglePause: ui.togglePause,
    openDock: handleOpenDrawer,
    togglePassagesCollapsed,
    undoHighlight,
  });

  // submit / 退出 / 答题 / 标记 等 actions.
  const handleSubmit = useCallback(async () => {
    flushPendingPracticeAnswers();
    const latestAnswers = usePracticeStore.getState().answers;
    // SPEC §11 第 6 条 (P3a master overrule, 2026-05-11): 交卷前 block 校验.
    // multi 题答 1 项视作"还没选完", 阻塞交卷给提示, 跟 UI hint 互补.
    // BE 至少 2 校验单独 ticket — 这里前端 block 已覆盖 SPEC §11 第 6 条主流程.
    const violating = findMultiChoiceUnderTwo(sessionData.sections, latestAnswers);
    if (violating !== null) {
      toast.warn(
        '多选题需至少选 2 项',
        `第 ${violating.displayNo} 题还差选项, 请补齐后再交卷`,
      );
      return;
    }
    ui.setIsSubmitting(true);
    try {
      await api.post(`/practice/sessions/${sessionId}/complete`, {
        answers: latestAnswers,
      });
      trackEvent({
        eventName: 'practice_session_completed',
        sessionId: String(sessionId),
        properties: {
          answeredCount: String(Object.keys(latestAnswers).length),
          studyTaskId:
            currentStudyTaskId === null ? 'none' : String(currentStudyTaskId),
        },
      });
      if (currentStudyTaskId !== null) {
        try {
          await patchStudyTask.mutateAsync({
            id: currentStudyTaskId,
            status: 'completed',
          });
        } catch (err) {
          logger.error('study_plan.task.complete_failed', {
            taskId: currentStudyTaskId,
            sessionId,
            err: String(err),
          });
          toast.warn(PRACTICE_COPY.sessionSubmitSyncWarn);
        }
      }
      clearSession();
      onNavigate(`/practice/result/${sessionId}`);
    } catch (err) {
      logger.error('practice.submit.failed', {
        sessionId,
        err: String(err),
      });
      toast.error(ERROR_COPY.sessionSubmit.title, PRACTICE_COPY.sessionSubmitRetryDesc);
      throw err;
    } finally {
      ui.setIsSubmitting(false);
    }
  }, [
    currentStudyTaskId,
    patchStudyTask,
    sessionId,
    sessionData.sections,
    clearSession,
    onNavigate,
    ui,
  ]);

  const handleAnswer = useCallback(
    (questionId: string, optionKeys: string[]) => {
      updateAnswer(questionId, optionKeys);
    },
    [updateAnswer],
  );
  const handleToggleMark = useCallback(
    (questionId: string, next: boolean) => {
      setFlags([questionId], next);
    },
    [setFlags],
  );
  const handleSelectQuestion = useCallback(
    (questionId: string) => {
      setCurrentVisibleQid(questionId);
      questionRegistry.scrollToQuestion(questionId);
      ui.setDockOpen(false);
    },
    [questionRegistry, setCurrentVisibleQid, ui],
  );
  const handlePrev = useCallback(() => {
    const target = flatQuestions[currentVisible.displayNo - 2];
    if (target !== undefined) handleSelectQuestion(String(target.question.questionId));
  }, [currentVisible.displayNo, flatQuestions, handleSelectQuestion]);
  const handleNext = useCallback(() => {
    const target = flatQuestions[currentVisible.displayNo];
    if (target !== undefined) handleSelectQuestion(String(target.question.questionId));
  }, [currentVisible.displayNo, flatQuestions, handleSelectQuestion]);
  const handleExit = useCallback(() => {
    clearSession();
    onNavigate('/app');
  }, [clearSession, onNavigate]);

  // 当前题 derived label / id (scratch col 空状态文案 + sourceLabel)

  // NoteEditor: 单题级笔记 (跟 scratch chip 是两条线). 这里只是确保 modal
  // 打开前预拉笔记数据; 当前题卡的 hasNote 批量状态后续再接.
  useQuery({
    queryKey:
      ui.noteQuestionId !== null ? noteKeys.byQuestion(ui.noteQuestionId) : ['notes', 'noop'],
    queryFn: () => fetchQuestionNote(ui.noteQuestionId!),
    enabled: ui.noteQuestionId !== null,
    staleTime: 60_000,
  });

  const swipeHandlers = useFbMobileSwipe({ onPrev: handlePrev, onNext: handleNext });

  // 复用同 outlet. 答题进行中 analysis 走 placeholder (解析答完才解锁), notes
  const analysisPanel = useMemo(
    () => (
      <div data-testid="practice-aside-analysis" className="py-8 text-center">
        <p className="font-serif text-base text-ink-3">
          答完后查看解析 / 评分
        </p>
        <p className="font-mono text-tiny tracking-eyebrow uppercase text-ink-4 mt-2">
          {`Q${currentVisible.displayNo}`} / {totalQuestions}
        </p>
      </div>
    ),
    [currentVisible.displayNo, totalQuestions],
  );
  const notesPanel = useMemo(
    () => (
      <div data-testid="practice-aside-notes" className="py-6">
        <p className="font-serif text-base text-ink mb-4">
          当前题: {`Q${currentVisible.displayNo}`} · {currentVisible.sectionTitle}
        </p>
        <Button
          variant="primary"
          onClick={() => setNoteQuestionId(currentVisibleQuestionId)}
          data-testid="practice-aside-notes-open"
        >
          打开本题笔记
        </Button>
        <p className="font-mono text-tiny tracking-eyebrow text-ink-4 mt-4">
          笔记按题保存, 答题过程中可随时撰写或编辑.
        </p>
      </div>
    ),
    [
      currentVisible.displayNo,
      currentVisible.sectionTitle,
      currentVisibleQuestionId,
      setNoteQuestionId,
    ],
  );
  const askPanel = useMemo(
    () => (
      <div data-testid="practice-aside-ask" className="py-8 text-center">
        <p className="font-serif text-base text-ink-3">
          AI 答疑面板即将上线
        </p>
        <p className="font-mono text-tiny tracking-eyebrow uppercase text-ink-4 mt-2">
          答完本卷后启用
        </p>
      </div>
    ),
    [],
  );
  useAsideSet('analysis', analysisPanel);
  useAsideSet('notes', notesPanel);
  useAsideSet('ask', askPanel);

  return (
    <div
      className="flex flex-col min-h-full w-full bg-paper"
      data-testid="practice-session-fb"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchEnd={swipeHandlers.onTouchEnd}
    >
      {/* anchor 容器: FbSettingsPopover 走 absolute top-full right-* 定位到
          topbar 底部右侧, 不破 FbTopbar 现有 props in/out 契约. */}
      <div className="relative">
        <FbTopbar
          paperName={requirePaperName(sessionData.paperName)}
          partLabel={currentVisible.sectionTitle}
          timerDisplay={timerDisplay}
          isPaused={ui.isPaused}
          progressLabel={`${answeredCount} / ${totalQuestions}`}
          onExit={() => ui.setExitOpen(true)}
          onTogglePause={() => ui.setIsPaused(!ui.isPaused)}
          onOpenSettings={() => ui.setSettingsOpen(!ui.settingsOpen)}
          onSubmit={handleSubmit}
          isSubmitting={ui.isSubmitting}
          settingsOpen={ui.settingsOpen}
        />
        <FbSettingsPopover
          open={ui.settingsOpen}
          onClose={() => ui.setSettingsOpen(false)}
        />
      </div>
      <div data-testid="fb-session-main">
        <FbLayout
          readingCol={
            <FbReadingCol
              sectionItemsGroups={sectionItemsGroups}
              currentVisibleQid={currentVisibleQid}
              answers={answers}
              flagged={flagged}
              onAnswer={handleAnswer}
              onToggleMark={handleToggleMark}
              onOpenNote={(qid) => ui.setNoteQuestionId(qid)}
              registerQuestion={questionRegistry.registerQuestion}
              unregisterQuestion={questionRegistry.unregisterQuestion}
              onCurrentQuestionChange={setCurrentVisibleQid}
              passagesCollapsed={passagesCollapsed}
              onTogglePassagesCollapsed={togglePassagesCollapsed}
              onHighlightArm={selectionToolbar.arm}
              armedQid={selectionToolbar.armedQid}
            />
          }
          scratchCol={
            <FbScratchCol
              clips={scratchClips}
              answeredCount={answeredCount}
              currentQuestionLabel={currentVisibleLabel}
              currentQuestionId={currentVisibleQuestionId}
              onAddClip={addScratchClip}
              onRemoveClip={removeScratchClip}
            />
          }
        />
      </div>
      <FbScratchFab
        visible={answeredCount >= 5}
        clipCount={scratchClips.length}
        onClick={() => ui.setMobileScratchOpen(true)}
      />
      <FbFloatingAnswerDrawer
        sectionGroups={sectionGroups}
        answers={answers}
        flagged={flagged}
        currentVisibleQid={currentVisibleQid}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        onSelectQuestion={handleSelectQuestion}
        expanded={ui.dockOpen}
        onExpandedChange={ui.setDockOpen}
      />
      <FbMobileScratchSheet
        open={ui.mobileScratchOpen}
        onClose={() => ui.setMobileScratchOpen(false)}
        clips={scratchClips}
        currentQuestionLabel={currentVisibleLabel}
        currentQuestionId={currentVisibleQuestionId}
        onAddClip={addScratchClip}
        onRemoveClip={removeScratchClip}
      />
      <ExitConfirmModal
        open={ui.exitOpen}
        onClose={() => ui.setExitOpen(false)}
        onConfirm={handleExit}
      />
      <NoteEditor
        open={ui.noteQuestionId !== null}
        questionId={ui.noteQuestionId}
        onClose={() => ui.setNoteQuestionId(null)}
      />
      {/* P5b/3 划线浮工具条 — mode='selecting' 且 rect 存在时 portal mount. */}
      {selectionToolbar.mode === 'selecting' &&
      selectionToolbar.armedQid !== null &&
      selectionToolbar.toolbarRect !== null ? (
        <SelectionToolbar
          questionId={selectionToolbar.armedQid}
          rect={selectionToolbar.toolbarRect}
          onClose={selectionToolbar.close}
        />
      ) : null}
    </div>
  );
}
