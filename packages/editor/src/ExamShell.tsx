import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import { useExamSession } from './hooks/useExamSession';
import { TopBar } from './TopBar';
import { MaterialsPanel } from './panels/MaterialsPanel';
import { AnswerArea } from './panels/AnswerArea';
import { ScratchPanel } from './panels/ScratchPanel';
import { bodyChars } from './lib/bodyChars';
import { hasReachedMinimum } from './lib/wordLimits';
import { PrestartModal } from './modals/PrestartModal';
import { PausedOverlay } from './modals/PausedOverlay';
import { SubmitDialog } from './modals/SubmitDialog';
import { WarnToast } from './modals/WarnToast';
import './styles/exam.css';

const SAVE_DEBOUNCE_MS = 1500;

interface Props {
  onAutosave?: () => void;
  onSubmit: () => void;
  /**
   * Phase D — 'single' = 跨卷单题专项练习 mode (1 题包装的 Paper).
   * 'paper' (default) = 整卷模考路径不变.
   *
   * single 行为差:
   *   - TopBar Row2 (N 个 question rings) 不渲染 (单题无切换)
   *   - TopBar 倒计时改"用时计时器" (向上计 elapsed, 不警示)
   *   - 5min warn useEffect skip (单题不限时)
   *   - submit 路径仍走 onSubmit prop, 由父级决定 (POST /essay/grade 单条)
   */
  mode?: 'paper' | 'single';
}

// ExamShell — top-level frame for the exam route. Owns the cross-cutting
// concerns the prototype kept in EssayExamV2: 1Hz tick, autosave debounce,
// 5min warn-once, global shortcuts. Panel components stay dumb (they read /
// write store directly via narrow selectors).

export function ExamShell({ onAutosave, onSubmit, mode = 'paper' }: Props) {
  const paper = useExamSession((s) => s.paper);
  const phase = useExamSession((s) => s.phase);
  const currentQ = useExamSession((s) => s.currentQ);
  const elapsedByQ = useExamSession((s) => s.elapsedByQ);
  const warned5min = useExamSession((s) => s.warned5min);
  const leftMode = useExamSession((s) => s.leftMode);
  const leftWidthPx = useExamSession((s) => s.leftWidthPx);
  const rightOpen = useExamSession((s) => s.rightOpen);
  const rightWidthPx = useExamSession((s) => s.rightWidthPx);
  const textsByQ = useExamSession((s) => s.textsByQ);
  const scratch = useExamSession((s) => s.scratch);
  const highlights = useExamSession((s) => s.highlights);

  const tick = useExamSession((s) => s.tick);
  const warn5min = useExamSession((s) => s.warn5min);
  const setLeftMode = useExamSession((s) => s.setLeftMode);
  const setLeftWidthPx = useExamSession((s) => s.setLeftWidthPx);
  const setRightOpen = useExamSession((s) => s.setRightOpen);
  const setRightWidthPx = useExamSession((s) => s.setRightWidthPx);
  const togglePause = useExamSession((s) => s.togglePause);
  const markSaved = useExamSession((s) => s.markSaved);
  const setCelebrateQ = useExamSession((s) => s.setCelebrateQ);
  const setOverview = useExamSession((s) => s.setOverview);
  const requestFocusSearch = useExamSession((s) => s.requestFocusSearch);

  // Per-question 字数 — derived once and memoised so TopBar's question rings
  // and the celebrate monitor below subscribe to a stable array.
  const charsByQ = useMemo(() => textsByQ.map(bodyChars), [textsByQ]);
  const prevDoneRef = useRef<readonly boolean[]>([]);

  // Celebrate trigger — fires once per question the moment its 字数 crosses
  // a real minimum. Max-only prompts do not have a completion threshold.
  useEffect(() => {
    if (!paper) return;
    const nowDone = charsByQ.map((n, i) => hasReachedMinimum(paper.questions[i], n));
    const prev = prevDoneRef.current;
    const just = nowDone.findIndex((d, i) => d && !(prev[i] ?? false));
    prevDoneRef.current = nowDone;
    if (just >= 0) setCelebrateQ(just);
  }, [paper, charsByQ, setCelebrateQ]);

  const [resizing, setResizing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [submitDialog, setSubmitDialog] = useState(false);
  const warnToastQ = useExamSession((s) => s.warnToastQ);
  const triggerWarnToast = useExamSession((s) => s.triggerWarnToast);
  const hideWarnToast = useExamSession((s) => s.hideWarnToast);

  // Single 1Hz wall clock — drives both countdown tick and the "Ns 前保存"
  // display. Skipped in prestart/submitted: prestart has nothing saved yet
  // (saved-ago label is irrelevant) and submitted is terminal. Keeping it
  // running in those phases would re-render the whole shell every second
  // for no display update.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return;
    const id = window.setInterval(() => {
      tick();
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, tick]);

  // 5-min warn — fires once per question, the moment remaining drops to the
  // threshold (min 5min, 25% of duration). Persistent ⏱ 收尾 badge stays in
  // the topbar; the WarnToast pops for 4s.
  // Phase D: single mode 不限时, skip 整 effect — 单题 view 不显示 ⏱ 收尾
  // badge / WarnToast (Phase D 任务定义改"用时计时器").
  useEffect(() => {
    if (mode === 'single') return;
    if (phase !== 'running' || !paper) return;
    const q = paper.questions[currentQ];
    const remaining = q.durationSec - elapsedByQ[currentQ];
    const warnAt = Math.min(5 * 60, Math.round(q.durationSec * 0.25));
    if (!warned5min[currentQ] && remaining <= warnAt) {
      warn5min(currentQ);
      triggerWarnToast(currentQ);
    }
  }, [mode, phase, paper, currentQ, elapsedByQ, warned5min, warn5min, triggerWarnToast]);

  // Hide the warn toast 4s after it was triggered.
  useEffect(() => {
    if (warnToastQ < 0) return;
    const id = window.setTimeout(() => hideWarnToast(), 4000);
    return () => window.clearTimeout(id);
  }, [warnToastQ, hideWarnToast]);

  // 1.5s autosave debounce — anything that mutates persistable state retriggers.
  // Persists via the EssayClient hook supplied by the route view (PR2 wires
  // mockEssayClient.saveSnapshot through the onAutosave prop). Locked to
  // running/paused: prestart writes nothing yet, submitted is terminal and
  // overwriting the final snapshot would corrupt the grading record.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return;
    if (!paper) return;
    const id = window.setTimeout(() => {
      onAutosave?.();
      markSaved();
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [phase, paper, textsByQ, scratch, highlights, onAutosave, markSaved]);

  // Global shortcuts. SubmitDialog owns its own ESC (see modals/SubmitDialog),
  // so we don't gate Escape behind cmd here anymore.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      if (e.key === '\\') {
        e.preventDefault();
        setRightOpen((v) => !v);
      } else if (e.key === '/') {
        e.preventDefault();
        setLeftMode(leftMode === 'collapsed' ? 'normal' : 'collapsed');
      } else if (e.key.toLowerCase() === 's') {
        // ⌘S = manual save NOW. 永远 preventDefault 阻止浏览器原生"另存为"
        // dialog. PR3 review P1 #4: phase guard 内层 — 仅 running/paused 真写
        // snapshot. submitting 时 toSnapshot 会带 phase='submitting' 写进
        // localStorage, 后续 hydrate 读到死 snapshot 会让 ExamShell 卡在没
        // 渲染分支的 phase. submitted 时已交完, 写也没意义.
        e.preventDefault();
        if (phase === 'running' || phase === 'paused') {
          onAutosave?.();
          markSaved();
        }
      } else if (
        e.key === ' ' &&
        (phase === 'running' || phase === 'paused')
      ) {
        // ⌘Space 仅 running / paused 切换. submitting / submitted 不消化空格,
        // 让浏览器原生处理 (e.g. 长答案区域空格输入). 防意外 togglePause 闯入
        // 在 submitted 态没人接 (PR3 audit, review P2 #5).
        e.preventDefault();
        togglePause();
      } else if (
        e.key === 'Enter' &&
        (phase === 'running' || phase === 'paused')
      ) {
        // ⌘Enter 打开 SubmitDialog 仅在答题中 (running/paused). submitting 时
        // 再触发会重叠开 dialog → 用户重复交卷. submitted 时已交完, 没意义.
        e.preventDefault();
        setSubmitDialog(true);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        // MaterialsPanel listens for this pulse and handles drawer-open +
        // input-focus + select. No querySelector / setTimeout needed.
        requestFocusSearch();
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setOverview((v) => !v);
      } else if (e.key === '.') {
        e.preventDefault();
        setLeftMode(leftMode === 'wide' ? 'normal' : 'wide');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    leftMode,
    phase,
    setLeftMode,
    setRightOpen,
    markSaved,
    onAutosave,
    togglePause,
    requestFocusSearch,
    setOverview,
  ]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      if (leftMode === 'collapsed') return;
      e.preventDefault();
      setResizing(true);
      const startX = e.clientX;
      const startWidth = leftWidthPx;
      const onMove = (ev: MouseEvent) => {
        setLeftWidthPx(startWidth + (ev.clientX - startX));
      };
      const onUp = () => {
        setResizing(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [leftMode, leftWidthPx, setLeftWidthPx],
  );

  const startResizeRight = useCallback(
    (e: React.MouseEvent) => {
      if (!rightOpen) return;
      e.preventDefault();
      setResizing(true);
      const startX = e.clientX;
      const startWidth = rightWidthPx;
      const onMove = (ev: MouseEvent) => {
        // dragging the left edge of the right panel grows its width when
        // the cursor moves left → invert the delta.
        setRightWidthPx(startWidth - (ev.clientX - startX));
      };
      const onUp = () => {
        setResizing(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [rightOpen, rightWidthPx, setRightWidthPx],
  );

  const containerRef = useRef<HTMLDivElement>(null);

  if (!paper) return null;
  const currentQuestion = paper.questions[currentQ];
  const currentText = textsByQ[currentQ] ?? '';
  const currentWritten = bodyChars(currentText);
  const currentRemaining = currentQuestion.durationSec - (elapsedByQ[currentQ] ?? 0);

  // 80px collapsed columns leave enough room for the new horizontal hint
  // strip ("点击查看给定资料" / "点击输入草稿纸"). 36px would have crammed the
  // text vertical-rl, which the redesign is moving away from.
  const leftWidth =
    leftMode === 'collapsed'
      ? '80px'
      : leftMode === 'wide'
        ? `${Math.max(520, leftWidthPx + 240)}px`
        : `${leftWidthPx}px`;
  const rightWidth = rightOpen ? `${rightWidthPx}px` : '80px';

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-surface flex flex-col overflow-hidden font-sans relative"
    >
      <TopBar onSubmit={() => setSubmitDialog(true)} nowMs={nowMs} mode={mode} />

      <div
        className={cn(
          'flex-1 grid overflow-hidden min-h-0',
          resizing ? 'select-none' : 'transition-[grid-template-columns] duration-base',
        )}
        style={{ gridTemplateColumns: `${leftWidth} 1fr ${rightWidth}` }}
      >
        {/* Left — materials panel + collapse toggle + resizer */}
        {leftMode !== 'collapsed' ? (
          <div className="relative min-w-0 min-h-0">
            <MaterialsPanel />
            <span className="absolute top-3 -right-3 z-20 inline-flex">
              <Tooltip label="收起资料 (⌘/)">
                <button
                  type="button"
                  onClick={() => setLeftMode('collapsed')}
                  aria-label="收起资料栏"
                  className={cn(
                    'w-7 h-9 rounded-r-card',
                    'bg-surface/80 backdrop-blur-sm border border-line border-l-0',
                    'text-ink-3 flex items-center justify-center',
                    'transition-all duration-base cursor-pointer',
                    'hover:bg-surface hover:text-accent hover:ring-2 hover:ring-accent/40',
                  )}
                  data-testid="exam-shell-left-collapse-btn"
                >
                  <PanelLeftCloseIcon className="w-4 h-4" />
                </button>
              </Tooltip>
            </span>
            <span className="absolute top-0 bottom-0 right-0 -translate-x-1/2 w-[6px] z-10 flex items-stretch">
              <Tooltip label="拖拽调整宽度 · 双击重置">
                {/* a11y: resizer drag handle. role="separator" 是 ARIA 拖拽分隔符标准
                    role, 不算 interactive (plugin spec); resize 是 mouse-only enhancement,
                    keyboard 用户走收起 / 展开 button (line 341 + 367). 行级 escape. */}
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                <div
                  onMouseDown={startResize}
                  onDoubleClick={() => setLeftWidthPx(320)}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="左侧资料栏宽度"
                  tabIndex={0}
                  className={cn(
                    'relative w-full h-full cursor-col-resize', /* hardcode-allow: drag handle sub-pixel offset for centerline */
                    'transition-colors duration-base',
                    resizing ? 'bg-accent/15' : 'hover:bg-accent/10',
                  )}
                  data-testid="exam-shell-left-resizer"
                >
                  <div
                    className={cn(
                      'absolute top-1/2 left-px -translate-y-1/2 w-[3px] h-8 rounded-tiny', /* hardcode-allow: handle pin width tuned to 6px gutter */
                      'transition-colors duration-base',
                      resizing ? 'bg-accent opacity-100' : 'bg-line-3 opacity-60',
                    )}
                  />
                </div>
              </Tooltip>
            </span>
          </div>
        ) : (
          <span className="inline-flex min-h-0">
            <Tooltip label="展开资料 (⌘/)">
            <button
              type="button"
              onClick={() => setLeftMode('normal')}
              aria-label="展开资料栏"
              className={cn(
                'bg-surface border-r border-line cursor-pointer',
                'w-full h-full flex flex-col items-center justify-center gap-2 py-4',
                'text-ink-4 transition-colors duration-base group',
                'hover:bg-surface-alt',
              )}
              data-testid="exam-shell-left-expand-btn"
            >
            <PanelLeftOpenIcon
              className="w-4 h-4 text-ink-3 group-hover:text-accent transition-colors duration-base"
            />
            </button>
            </Tooltip>
          </span>
        )}

        <AnswerArea />

        {rightOpen ? (
          <div className="relative min-w-0 min-h-0">
            <ScratchPanel />
            <span className="absolute top-3 -left-3 z-20 inline-flex">
              <Tooltip label="收起草稿 (⌘\)">
                <button
                  type="button"
                  onClick={() => setRightOpen(false)}
                  aria-label="收起草稿栏"
                  className={cn(
                    'w-7 h-9 rounded-l-card',
                    'bg-surface/80 backdrop-blur-sm border border-line border-r-0',
                    'text-ink-3 flex items-center justify-center',
                    'transition-all duration-base cursor-pointer',
                    'hover:bg-surface hover:text-accent hover:ring-2 hover:ring-accent/40',
                  )}
                  data-testid="exam-shell-right-collapse-btn"
                >
                  <PanelRightCloseIcon className="w-4 h-4" />
                </button>
              </Tooltip>
            </span>
            <span className="absolute top-0 bottom-0 left-0 -translate-x-1/2 w-[6px] z-10 flex items-stretch">
              <Tooltip label="拖拽调整宽度 · 双击重置">
                {/* a11y: 右侧 resizer, 跟左侧同模式. 详见左侧 resizer 注释. */}
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                <div
                  onMouseDown={startResizeRight}
                  onDoubleClick={() => setRightWidthPx(260)}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="右侧草稿栏宽度"
                  tabIndex={0}
                  className={cn(
                    'relative w-full h-full cursor-col-resize', /* hardcode-allow: drag handle sub-pixel offset for centerline */
                    'transition-colors duration-base',
                    resizing ? 'bg-accent/15' : 'hover:bg-accent/10',
                  )}
                  data-testid="exam-shell-right-resizer"
                >
                  <div
                    className={cn(
                      'absolute top-1/2 right-px -translate-y-1/2 w-[3px] h-8 rounded-tiny', /* hardcode-allow: handle pin width tuned to 6px gutter */
                      'transition-colors duration-base',
                      resizing ? 'bg-accent opacity-100' : 'bg-line-3 opacity-60',
                    )}
                  />
                </div>
              </Tooltip>
            </span>
          </div>
        ) : (
          <span className="inline-flex min-h-0">
            <Tooltip label="展开草稿 (⌘\)">
            <button
              type="button"
              onClick={() => setRightOpen(true)}
              aria-label="展开草稿栏"
              className={cn(
                'bg-surface border-l border-line cursor-pointer',
                'w-full h-full flex flex-col items-center justify-center gap-2 py-4',
                'text-ink-4 transition-colors duration-base group',
                'hover:bg-surface-alt',
              )}
              data-testid="exam-shell-right-expand-btn"
            >
            <PanelRightOpenIcon
              className="w-4 h-4 text-ink-3 group-hover:text-accent transition-colors duration-base"
            />
            </button>
            </Tooltip>
          </span>
        )}
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
          // PR3 D7=B 拦截: paper.questions 里 textsByQ[i] trim 后空的题号 list.
          // SubmitDialog 收到非空 list 会改红底 "提交未答题" + 列题号警示
          // (而非静默跳过 — 防用户以为交了 N 题实际只评了 M 题).
          // 全答了传 [] 维持原"确认交卷" 黑底.
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
      {warnToastQ === currentQ && (
        <WarnToast remainingSec={currentRemaining} />
      )}
    </div>
  );
}
