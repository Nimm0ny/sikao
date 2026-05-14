import { cn } from '@sikao/shared-utils';
import { IconBtn, Tooltip } from '@sikao/ui/ui';
import { PauseIcon, PlayIcon, SettingsIcon } from '@sikao/ui/icons';

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
  readonly onTogglePause: () => void;
  readonly onOpenSettings: () => void;
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
  onTogglePause,
  onOpenSettings,
  settingsOpen = false,
}: FbTopbarProps) {
  return (
    <header
      className={cn(
        'fb-top sticky top-0 z-30 grid items-center gap-2 md:gap-4',
        // Wave 9 Phase 2a (2026-05-12): mobile h-12 紧凑高度, tablet+ h-14
        // (mobile-style-guide §4.2 间距更紧).
        'grid-cols-[auto_1fr_auto] h-12 md:h-14 px-3 md:px-6',
        'bg-surface border-b border-line',
      )}
      data-testid="fb-topbar"
    >
      <FbTopbarLeft paperName={paperName} partLabel={partLabel} />
      <FbTopbarCenter
        timerDisplay={timerDisplay}
        isPaused={isPaused}
        progressLabel={progressLabel}
      />
      <FbTopbarRight
        onTogglePause={onTogglePause}
        onOpenSettings={onOpenSettings}
        isPaused={isPaused}
        settingsOpen={settingsOpen}
      />
    </header>
  );
}

interface FbTopbarLeftProps {
  readonly paperName: string;
  readonly partLabel?: string;
}

function FbTopbarLeft({ paperName, partLabel }: FbTopbarLeftProps) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span
        className="font-serif text-base font-medium text-ink truncate hidden md:inline"
      >
        {paperName}
      </span>
      {partLabel !== undefined && partLabel !== '' ? (
        <span
          className={cn(
            'hidden md:inline pl-3 ml-2 border-l border-line',
            'font-mono text-tiny tracking-wider uppercase text-ink-3 truncate',
          )}
        >
          {partLabel}
        </span>
      ) : null}
    </div>
  );
}

interface FbTopbarCenterProps {
  readonly timerDisplay: string;
  readonly isPaused: boolean;
  readonly progressLabel: string;
}

function FbTopbarCenter({ timerDisplay, isPaused, progressLabel }: FbTopbarCenterProps) {
  return (
    <div className="flex items-center justify-center gap-6">
      <span
        role="timer"
        aria-label={isPaused ? '已暂停' : `已用 ${timerDisplay}`}
        className={cn(
          'font-mono text-base tabular-nums tracking-loose',
          isPaused
            ? 'text-ink-3 border-b border-dashed border-line-3'
            : 'text-ink',
        )}
        data-paused={isPaused || undefined}
        data-testid="fb-topbar-timer"
      >
        {timerDisplay}
      </span>
      <span
        className="hidden md:inline font-mono text-sm tabular-nums tracking-loose text-ink-3"
        data-testid="fb-topbar-progress"
      >
        {progressLabel}
      </span>
    </div>
  );
}

interface FbTopbarRightProps {
  readonly onTogglePause: () => void;
  readonly onOpenSettings: () => void;
  readonly isPaused: boolean;
  readonly settingsOpen: boolean;
}

function FbTopbarRight({
  onTogglePause,
  onOpenSettings,
  isPaused,
  settingsOpen,
}: FbTopbarRightProps) {
  return (
    <div className="flex items-center gap-2" role="toolbar" aria-label="答题工具栏">
      <Tooltip label={isPaused ? '继续 · 空格' : '暂停 · 空格'}>
        <IconBtn
          size="sm"
          aria-label={isPaused ? '继续' : '暂停'}
          aria-pressed={isPaused}
          onClick={onTogglePause}
          data-testid="fb-topbar-pause"
        >
          {isPaused ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
        </IconBtn>
      </Tooltip>
      <Tooltip label="设置">
        <IconBtn
          size="sm"
          aria-label="阅读设置"
          aria-expanded={settingsOpen}
          aria-haspopup="dialog"
          aria-controls="fb-settings-popover"
          onClick={onOpenSettings}
          data-testid="fb-topbar-settings"
        >
          <SettingsIcon size={16} />
        </IconBtn>
      </Tooltip>
    </div>
  );
}
