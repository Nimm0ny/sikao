import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';
import {
  ActionMarkIcon,
  ActionNoteEditIcon,
  NavBackIcon,
  NavSubmitIcon,
  ToolPauseIcon,
  ToolPlayIcon,
} from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { PracticeTimer, type PracticeTimerMode } from './PracticeTimer';
import { SettingsPopover } from './SettingsPopover';
import { ViewModeToggle, type PracticeViewMode } from './ViewModeToggle';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// Phase 3.1 fenbi-merge — 单行 56px header 替代 SessionFooter 主操作栏.
// 对齐 prototype 03 .session-header. 左: 返回 / paper title / 进度 meta /
// timer pill. 右: ViewModeToggle / 标记 / 笔记 / 设置 / 交卷.
//
// SessionFooter 不删, 简化为只剩 prev/next 大箭头 (deck 模式翻页用,
// scroll 模式不渲染).
//
// Wave D 删除 header 答题卡 IconButton — 唯一入口改为左下 sticky tab
// (AnswerCardStickyTab) + 底部 65% panel (AnswerCardPanel), 对齐 fenbi 截图.
//
// Dumb component — 所有数据 / 回调由 PracticeShell 注入.

export interface SessionHeaderTimer {
  readonly durationSeconds: number;
  readonly elapsedSeconds: number;
  readonly mode: PracticeTimerMode;
  readonly onTimeout?: () => void;
}

export interface SessionHeaderProps {
  readonly paperName: string;
  readonly progressLabel: string;
  readonly answeredCount: number;
  readonly totalCount: number;
  readonly isMarked: boolean;
  readonly hasNote: boolean;
  readonly isPaused: boolean;
  readonly viewMode: PracticeViewMode;
  readonly scrollViewDisabled?: boolean;
  readonly onViewModeChange: (mode: PracticeViewMode) => void;
  readonly onPause: () => void;
  readonly onExit: () => void;
  readonly onMark: () => void;
  readonly onOpenNote: () => void;
  readonly onSubmit: () => void;
  readonly isSubmitting?: boolean;
  readonly timer?: SessionHeaderTimer;
  readonly className?: string;
}

export function SessionHeader({
  paperName,
  progressLabel,
  answeredCount,
  totalCount,
  isMarked,
  hasNote,
  isPaused,
  viewMode,
  scrollViewDisabled = true,
  onViewModeChange,
  onPause,
  onExit,
  onMark,
  onOpenNote,
  onSubmit,
  isSubmitting = false,
  timer,
  className,
}: SessionHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex items-center justify-between gap-4 px-4 md:px-6 h-14',
        'border-b border-line bg-surface',
        className,
      )}
      data-testid="session-header"
    >
      <HeaderLeft
        paperName={paperName}
        progressLabel={progressLabel}
        answeredCount={answeredCount}
        totalCount={totalCount}
        isPaused={isPaused}
        onPause={onPause}
        onExit={onExit}
        timer={timer}
      />
      <HeaderRight
        isMarked={isMarked}
        hasNote={hasNote}
        viewMode={viewMode}
        scrollViewDisabled={scrollViewDisabled}
        onViewModeChange={onViewModeChange}
        onMark={onMark}
        onOpenNote={onOpenNote}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
      />
    </header>
  );
}

interface HeaderLeftProps {
  readonly paperName: string;
  readonly progressLabel: string;
  readonly answeredCount: number;
  readonly totalCount: number;
  readonly isPaused: boolean;
  readonly onPause: () => void;
  readonly onExit: () => void;
  readonly timer?: SessionHeaderTimer;
}

function HeaderLeft({
  paperName,
  progressLabel,
  answeredCount,
  totalCount,
  isPaused,
  onPause,
  onExit,
  timer,
}: HeaderLeftProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <IconButton label="返回" onClick={onExit} data-testid="practice-exit">
        <NavBackIcon size={20} />
      </IconButton>
      <div className="min-w-0 hidden md:block">
        <div className="truncate text-sm font-medium text-ink-3">
          {paperName}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-ink-3 tabular-nums">
          <span>{progressLabel}</span>
          <span>
            已答 <b className="font-semibold text-ink">{answeredCount}</b> / {totalCount}
          </span>
        </div>
      </div>
      {timer !== undefined ? (
        <div
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-2 rounded-tiny border px-2 transition-colors',
            isPaused
              ? 'border-warn bg-warn-bg text-warn'
              : 'border-line bg-surface-alt text-ink',
          )}
          data-testid="practice-timer-cluster"
        >
          <Tooltip label={isPaused ? '继续答题' : '暂停答题'}>
            <button
              type="button"
              aria-label={isPaused ? '继续答题' : '暂停答题'}
              aria-pressed={isPaused || undefined}
              onClick={onPause}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-tiny transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isPaused ? 'text-warn hover:bg-surface' : 'text-ink hover:bg-surface',
              )}
              data-testid="practice-timer-button"
            >
              {isPaused ? <ToolPlayIcon size={14} /> : <ToolPauseIcon size={14} />}
            </button>
          </Tooltip>
          <span role="timer" aria-label={isPaused ? PRACTICE_COPY.sessionHeaderPaused : '答题计时'}>
            <PracticeTimer
              durationSeconds={timer.durationSeconds}
              elapsedSeconds={timer.elapsedSeconds}
              mode={timer.mode}
              paused={isPaused}
              onTimeout={timer.onTimeout}
              className={isPaused ? 'bg-warn-bg text-ink' : undefined}
            />
          </span>
        </div>
      ) : null}
    </div>
  );
}

interface HeaderRightProps {
  readonly isMarked: boolean;
  readonly hasNote: boolean;
  readonly viewMode: PracticeViewMode;
  readonly scrollViewDisabled: boolean;
  readonly onViewModeChange: (mode: PracticeViewMode) => void;
  readonly onMark: () => void;
  readonly onOpenNote: () => void;
  readonly onSubmit: () => void;
  readonly isSubmitting: boolean;
}

function HeaderRight({
  isMarked,
  hasNote,
  viewMode,
  scrollViewDisabled,
  onViewModeChange,
  onMark,
  onOpenNote,
  onSubmit,
  isSubmitting,
}: HeaderRightProps) {
  return (
    <div className="flex shrink-0 items-center gap-2" role="toolbar" aria-label="答题操作">
      <ViewModeToggle
        value={viewMode}
        onChange={onViewModeChange}
        scrollDisabled={scrollViewDisabled}
      />
      <IconButton label="标记" pressed={isMarked} onClick={onMark} data-testid="session-header-mark">
        <ActionMarkIcon size={20} />
      </IconButton>
      <IconButton
        label={hasNote ? '笔记 (已写)' : '笔记'}
        pressed={hasNote}
        onClick={onOpenNote}
        data-testid="session-header-note"
      >
        <ActionNoteEditIcon size={20} />
      </IconButton>
      <SettingsPopover />
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        aria-label="交卷"
        aria-busy={isSubmitting || undefined}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-tiny px-4 text-sm font-semibold',
          'bg-ink text-white hover:bg-ink-1 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'disabled:cursor-not-allowed disabled:opacity-45',
        )}
        data-testid="session-header-submit"
      >
        {isSubmitting ? (
          <span className="h-4 w-4 animate-spin rounded-pill border-2 border-current border-t-transparent" />
        ) : (
          <NavSubmitIcon size={16} />
        )}
        交卷
      </button>
    </div>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string;
  readonly pressed?: boolean;
  readonly children?: ReactNode;
}

function IconButton({
  label,
  pressed = false,
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip label={label}>
      {/* svg-only-allow: main-cta submit keeps visible destination text */}
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed || undefined}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-tiny border transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'disabled:cursor-not-allowed disabled:opacity-45',
          pressed
            ? 'border-line bg-warn-bg text-ink'
            : 'border-transparent text-ink-3 hover:bg-surface-alt hover:text-ink',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  );
}
