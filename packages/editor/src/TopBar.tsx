import { useMemo, useState } from 'react';
import {
  ClockIcon,
  HelpIcon,
  LoaderIcon,
  PauseIcon,
  PlayIcon,
  SendIcon,
} from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import { formatTime } from './lib/gridLayout';
import { bodyChars } from './lib/bodyChars';
import {
  getWordLimitTarget,
  hasExceededMaximum,
  hasReachedMinimum,
} from './lib/wordLimits';
import { useExamSession } from './hooks/useExamSession';
import { QuestionRing } from './pieces/QuestionRing';
import { QuestionPeek } from './pieces/QuestionPeek';

// TopBar — double row chrome above the workspace.
//   Row 1 (~46px): 品牌 / 字数 / autosave / 倒计时 / 暂停 / 交卷
//   Row 2 (~44px): N 个圆形进度环按钮 + 题干浮层切换 (N = paper.questions.length, 申论真题通常 3-5)
//
// hoverQ stays local — it's purely a TopBar peek-popover concern.
// celebrateQ comes from the store (ExamShell drives it from textsByQ deltas).

interface Props {
  onSubmit: () => void;
  nowMs: number;
  /**
   * Phase D — 'single' = 跨卷单题模式. 改:
   *   - 倒计时 → "用时计时器" (向上计 elapsed, 不警示)
   *   - Row2 (N 个 question rings + 题干 toggle) 不渲染
   *   - "暂停" 按钮仍可见 (单题用户也想暂停想题), "交卷" 改 "提交评分"
   */
  mode?: 'paper' | 'single';
}

export function TopBar({ onSubmit, nowMs, mode = 'paper' }: Props) {
  const paper = useExamSession((s) => s.paper);
  const phase = useExamSession((s) => s.phase);
  const currentQ = useExamSession((s) => s.currentQ);
  const textsByQ = useExamSession((s) => s.textsByQ);
  const elapsedByQ = useExamSession((s) => s.elapsedByQ);
  const warned5min = useExamSession((s) => s.warned5min);
  const savedAt = useExamSession((s) => s.savedAt);
  const celebrateQ = useExamSession((s) => s.celebrateQ);
  const togglePause = useExamSession((s) => s.togglePause);
  const setCurrentQ = useExamSession((s) => s.setCurrentQ);
  const setCelebrateQ = useExamSession((s) => s.setCelebrateQ);

  const [hoverQ, setHoverQ] = useState(-1);
  const [pinnedPeek, setPinnedPeek] = useState(false);

  const charsByQ = useMemo(() => textsByQ.map(bodyChars), [textsByQ]);
  const peekIdx = pinnedPeek ? currentQ : hoverQ;

  if (!paper) return null;
  const question = paper.questions[currentQ];
  const targetWords = getWordLimitTarget(question);
  const written = charsByQ[currentQ] ?? 0;
  const elapsed = elapsedByQ[currentQ] ?? 0;
  // Phase D: single mode 用"用时计时器" — 显 elapsed (向上计), 永不警示.
  // paper mode 维持原"倒计时" 行为不变.
  const remaining = question.durationSec - elapsed;
  const isSingle = mode === 'single';
  const timerValue = isSingle ? elapsed : remaining;
  const timeWarn = !isSingle && remaining < Math.min(5 * 60, Math.round(question.durationSec * 0.25));
  const timeCritical = !isSingle && remaining < 60;
  const savedAgoSec = Math.max(0, Math.floor((nowMs - savedAt) / 1000));
  const isPrestart = phase === 'prestart';
  const isPaused = phase === 'paused';
  // PR3: submitting / submitted 锁交卷按钮防双击 / 重复提交 (review P0 #2 +
  // P2 #5 audit 配套). isPrestart 时也 disabled (PrestartModal 拦在前面).
  const submitDisabled =
    isPrestart || phase === 'submitting' || phase === 'submitted';
  const submitting = phase === 'submitting';
  const reachedTarget = hasReachedMinimum(question, written);
  const exceededTarget = hasExceededMaximum(question, written);

  return (
    <header className="bg-surface border-b border-line shrink-0 z-10 relative">
      {/* Row 1 */}
      <div className="px-5 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-tiny bg-ink text-surface flex items-center justify-center font-serif text-sm font-bold">
            思
          </div>
          <div>
            <div className="text-sm font-bold text-ink flex items-center gap-2">
              申论模拟考场
              <span className="text-tiny px-2 py-px rounded-pill bg-accent-50 text-accent font-semibold">
                v2
              </span>
            </div>
            <div className="text-xs text-ink-3 leading-tight">{paper.name}</div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-baseline gap-1 px-3 py-1 bg-surface-alt border border-line rounded-tiny">
          <span className="text-xs text-ink-3">本题</span>
          <span
            className={cn(
              'text-base font-bold font-mono tabular-nums',
              exceededTarget ? 'text-err' : reachedTarget ? 'text-ok' : 'text-ink',
            )}
            data-testid="exam-topbar-word-count"
          >
            {written}
          </span>
          <span className="text-xs text-ink-4 font-mono">/ {targetWords}</span>
        </div>

        <div
          className="flex items-center gap-2 text-xs text-ink-3 cursor-help"
          aria-live="polite"
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-pill transition-colors duration-base', /* hardcode-allow: 6px tracker dot, smaller than 8px step would feel cluttered */
              savedAgoSec < 2 ? 'bg-ok' : 'bg-line-3',
            )}
            aria-hidden
          />
          {savedAgoSec < 2 ? '已自动保存' : `${savedAgoSec}s 前保存`}
        </div>

        <div
          className={cn(
            'flex items-stretch rounded-tiny overflow-hidden border',
            timeCritical
              ? 'border-bad-bg exam-pulse-warn'
              : timeWarn
                ? 'border-warn-bg'
                : 'border-line',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-2',
              timeCritical
                ? 'bg-bad-bg text-err'
                : timeWarn
                  ? 'bg-warn-bg text-warn'
                  : 'bg-surface-alt text-ink-3',
            )}
          >
            <ClockIcon className="w-4 h-4" />
            {isSingle ? (
              <span className="text-tiny font-semibold tracking-wider text-ink-3">
                用时
              </span>
            ) : null}
            <span
              className={cn(
                'text-md font-bold font-mono tabular-nums tracking-wide',
                timeCritical ? 'text-err' : timeWarn ? 'text-warn' : 'text-ink',
              )}
              aria-live="polite"
              data-testid="exam-topbar-timer"
            >
              {formatTime(timerValue)}
            </span>
          </div>
          {warned5min[currentQ] && remaining > 0 && (
            <Tooltip label="已进入 5 分钟收尾区">
              <div
                className={cn(
                  'flex items-center gap-1 px-2 text-tiny font-bold tracking-wider',
                  timeCritical ? 'bg-bad-bg text-err' : 'bg-warn-bg text-warn',
                )}
              >
                <ClockIcon className="w-3 h-3" />
                收尾
              </div>
            </Tooltip>
          )}
        </div>

        <button
          type="button"
          onClick={togglePause}
          disabled={isPrestart}
          aria-label={isPaused ? '继续考试' : '暂停考试'}
          className={cn(
            'px-3 py-2 bg-surface border border-line text-ink-3 rounded-tiny text-xs font-semibold',
            'transition-colors duration-base hover:bg-surface-alt',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'inline-flex items-center gap-2',
          )}
          data-testid="exam-topbar-pause"
        >
          {isPaused ? (
            <PlayIcon className="w-3 h-3" />
          ) : (
            <PauseIcon className="w-3 h-3" />
          )}
        </button>

        {/* svg-only-allow: main-cta submit is the single destination action in this view */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          aria-label={submitting ? '提交中' : isSingle ? '提交评分' : '交卷'}
          className={cn(
            'px-4 py-2 bg-ink text-surface rounded-tiny text-xs font-bold',
            'transition-opacity duration-base',
            'disabled:cursor-not-allowed disabled:opacity-40',
            'inline-flex items-center gap-2',
          )}
          data-testid="exam-topbar-submit"
        >
          {submitting ? (
            <>
              <LoaderIcon className="w-3 h-3 animate-spin" /> 提交中
            </>
          ) : (
            <>
              <SendIcon className="w-3 h-3" /> {isSingle ? '提交评分' : '交卷'}
            </>
          )}
        </button>
      </div>

      {/* Row 2 — N progress-ring buttons + 题干 toggle. Phase D: single mode 不
          渲染 (单题无切换需求, 题干 toggle 替换为 view 内 q-prompt 直显). */}
      {!isSingle ? (
      <div
        className="px-5 pb-2 flex items-center gap-3 relative"
        data-testid="exam-topbar-row2"
      >
        <span className="text-tiny text-ink-4 font-semibold tracking-wider shrink-0">
          本卷题目
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {paper.questions.map((q, i) => (
            <QuestionRing
              key={i}
              question={q}
              index={i}
              written={charsByQ[i] ?? 0}
              elapsed={elapsedByQ[i] ?? 0}
              active={i === currentQ}
              pinned={i === currentQ && pinnedPeek}
              celebrating={celebrateQ === i}
              onSelect={() => {
                // Single-click only switches currentQ. Crucially it does NOT
                // touch pinnedPeek — a dblclick fires onClick twice before
                // onDoubleClick, and resetting pinnedPeek here would race
                // the toggle below into a no-op.
                if (i !== currentQ) setCurrentQ(i);
              }}
              onTogglePin={() => {
                // Double-click: align currentQ + toggle the peek pin. Lands
                // after both onClick fires, so the toggle is the last word.
                if (i !== currentQ) setCurrentQ(i);
                setPinnedPeek((v) => !v);
              }}
              onHover={(entered) => {
                if (entered) setHoverQ(i);
                else setHoverQ((h) => (h === i ? -1 : h));
              }}
              onCelebrateEnd={() => setCelebrateQ(-1)}
            />
          ))}
          <div className="flex-1" />
          <Tooltip label="查看题干">
            <button
              type="button"
              onClick={() => setPinnedPeek((v) => !v)}
              aria-label={pinnedPeek ? '取消固定题干' : '查看题干'}
              className={cn(
                'h-7 px-3 border border-line rounded-pill text-tiny font-semibold cursor-pointer',
                'inline-flex items-center gap-1 transition-colors duration-base',
                pinnedPeek ? 'bg-ink text-surface' : 'bg-surface text-ink-3 hover:bg-surface-alt',
              )}
              data-testid="exam-topbar-question-peek-toggle"
            >
              <HelpIcon className="w-3 h-3" />
            </button>
          </Tooltip>
        </div>

        {peekIdx >= 0 && peekIdx < paper.questions.length && (
          <QuestionPeek
            question={paper.questions[peekIdx]}
            isCurrent={peekIdx === currentQ}
            onSwitch={() => {
              setCurrentQ(peekIdx);
              setHoverQ(-1);
              setPinnedPeek(false);
            }}
            onMouseEnter={() => setHoverQ(peekIdx)}
            onMouseLeave={() => {
              if (!pinnedPeek) setHoverQ(-1);
            }}
          />
        )}
      </div>
      ) : null}
    </header>
  );
}
