import { cn } from '@sikao/shared-utils';
import { Button, IconBtn, Tooltip } from '@sikao/ui/ui';
import {
  ClockIcon,
  NavBackIcon,
  NavSubmitIcon,
  PauseIcon,
  PlayIcon,
  ToolSettingsIcon,
} from '@sikao/ui/icons';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// SIKAO Phase 3 (2026-05-09) → Wave 4 Phase 2A (2026-05-12) 改造:
// 行测顶部条 — sticky top, 极简 56px 高.
//
// 设计 SSOT: design/SIKAO/xingce-redesign/option-B-paper-quiet.html .fb-top.
//
// Wave 4 改造: 删 right region 的 "答题卡 / 提交" 两个 IconBtn (下沉到
// FbBottomDock sticky 底栏), 保留 pause + settings 两个常驻 IconBtn.
// onOpenDock / onSubmit / isSubmitting props 跟着删.
//
// 三段栅格:
//   - 左: paper title + meta (PART 02 数判) — md+ 显示
//   - 中: timer + 进度 (mono tabular)
//   - 右: 暂停 / 设置 IconBtn (32×32, SVG + Tooltip + aria-label)
//
// 全 SVG icon (CLAUDE.md §4 + sikao-xingce-decision §SVG-only). 当前题
// 焦点态使用 2px blue accent focus rail.
//
// Dumb by contract: 不读 store / 路由. 所有数据 / 回调由 caller.

export interface FbTopbarProps {
  readonly paperName: string;
  readonly partLabel?: string;
  readonly timerDisplay: string;
  readonly isPaused: boolean;
  readonly progressLabel: string;
  readonly onExit: () => void;
  readonly onTogglePause: () => void;
  readonly onOpenSettings: () => void;
  readonly onSubmit: () => void;
  readonly isSubmitting?: boolean;
  /**
   * settings popover 当前是否打开. 用于 settings IconBtn 的 aria-expanded
   * (a11y: 屏幕阅读器需要知道 toggle button 的当前 state). 默认 false.
   */
  readonly settingsOpen?: boolean;
}

export function FbTopbar({
  paperName,
  partLabel,
  timerDisplay,
  isPaused,
  progressLabel,
  onExit,
  onTogglePause,
  onOpenSettings,
  onSubmit,
  isSubmitting = false,
  settingsOpen = false,
}: FbTopbarProps) {
  return (
    <header
      className={cn(
        'fb-top sticky top-0 z-30 grid items-center gap-3',
        'grid-cols-1 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,280px)]',
        'min-h-14 px-4 py-3 md:px-6 md:py-0',
        'bg-paper/95 border-b border-line shadow-card backdrop-blur',
      )}
      data-testid="fb-topbar"
    >
      <FbTopbarLeft
        timerDisplay={timerDisplay}
        isPaused={isPaused}
        onExit={onExit}
        onTogglePause={onTogglePause}
      />
      <FbTopbarCenter
        paperName={paperName}
        partLabel={partLabel}
        progressLabel={progressLabel}
      />
      <FbTopbarRight
        onOpenSettings={onOpenSettings}
        onSubmit={onSubmit}
        isPaused={isPaused}
        isSubmitting={isSubmitting}
        settingsOpen={settingsOpen}
      />
    </header>
  );
}

interface FbTopbarLeftProps {
  readonly timerDisplay: string;
  readonly isPaused: boolean;
  readonly onExit: () => void;
  readonly onTogglePause: () => void;
}

function FbTopbarLeft({
  timerDisplay,
  isPaused,
  onExit,
  onTogglePause,
}: FbTopbarLeftProps) {
  const pauseLabel = isPaused ? PRACTICE_COPY.fbTopbarResume : PRACTICE_COPY.fbTopbarPause;
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 md:justify-start">
      <Tooltip label={PRACTICE_COPY.fbTopbarBack} side="right">
        <IconBtn
          size="sm"
          aria-label={PRACTICE_COPY.fbTopbarBack}
          onClick={onExit}
          data-testid="fb-topbar-back"
        >
          <NavBackIcon size={16} />
        </IconBtn>
      </Tooltip>
      <div
        className="flex items-center gap-2 text-ink-2"
        aria-label={PRACTICE_COPY.fbTopbarTimer}
      >
        <ClockIcon size={18} />
        <span
          className={cn(
            'font-mono text-body tabular-nums tracking-loose',
            isPaused ? 'text-ink-3' : 'text-ink',
          )}
          role="timer"
          aria-label={isPaused ? PRACTICE_COPY.sessionHeaderPaused : timerDisplay}
          data-paused={isPaused || undefined}
          data-testid="fb-topbar-timer"
        >
          {timerDisplay}
        </span>
        <Tooltip label={pauseLabel}>
          <IconBtn
            size="sm"
            aria-label={pauseLabel}
            aria-pressed={isPaused}
            onClick={onTogglePause}
            className="rounded-pill"
            data-testid="fb-topbar-pause"
          >
            {isPaused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
          </IconBtn>
        </Tooltip>
      </div>
    </div>
  );
}

interface FbTopbarCenterProps {
  readonly paperName: string;
  readonly partLabel?: string;
  readonly progressLabel: string;
}

function FbTopbarCenter({ paperName, partLabel, progressLabel }: FbTopbarCenterProps) {
  return (
    <div className="min-w-0 text-center">
      <span
        className="block truncate font-serif text-h3 font-semibold text-ink"
        data-testid="fb-topbar-title"
      >
        {paperName}
      </span>
      <div className="mt-1 flex items-center justify-center gap-2 font-mono text-tiny tracking-loose text-ink-3">
        {partLabel !== undefined && partLabel !== '' ? <span>{partLabel}</span> : null}
        <span className="tabular-nums" data-testid="fb-topbar-progress">
          {progressLabel}
        </span>
      </div>
    </div>
  );
}

interface FbTopbarRightProps {
  readonly onOpenSettings: () => void;
  readonly onSubmit: () => void;
  readonly isPaused: boolean;
  readonly isSubmitting: boolean;
  readonly settingsOpen: boolean;
}

function FbTopbarRight({
  onOpenSettings,
  onSubmit,
  isSubmitting,
  settingsOpen,
}: FbTopbarRightProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 md:justify-end"
      role="toolbar"
      aria-label={PRACTICE_COPY.fbTopbarAriaLabel}
    >
      <Tooltip label={PRACTICE_COPY.fbTopbarSettings}>
        <IconBtn
          size="sm"
          aria-label={PRACTICE_COPY.fbTopbarSettings}
          aria-expanded={settingsOpen}
          aria-haspopup="dialog"
          aria-controls="fb-settings-popover"
          onClick={onOpenSettings}
          data-testid="fb-topbar-settings"
        >
          <ToolSettingsIcon size={16} />
        </IconBtn>
      </Tooltip>
      <Button
        type="button"
        variant="primary"
        size="sm"
        leftIcon={<NavSubmitIcon size={16} />}
        onClick={onSubmit}
        isLoading={isSubmitting}
        aria-label={PRACTICE_COPY.fbTopbarSubmit}
        data-testid="fb-topbar-submit"
      >
        {PRACTICE_COPY.fbTopbarSubmit}
      </Button>
    </div>
  );
}
