// EssayTopbar — sticky top: paper title + total word count + IconBtn 暂停 /
// 设置 + 主 CTA 提交. Spec 04-essay.md (header inferred from artboard 04).
//
// Reads paper / textsByQ / phase from store. Submit + Settings / Pause
// callbacks bubble out via props (EssayShellSikao supplies the handlers).

import { IconBtn } from '@sikao/ui/ui/IconBtn';
import { Button } from '@sikao/ui/ui/Button';
import { Tooltip } from '@sikao/ui/ui/Tooltip';
import { NavSubmitIcon } from '@sikao/ui/icons/NavSubmitIcon';
import { PauseIcon } from '@sikao/ui/icons/PauseIcon';
import { PlayIcon } from '@sikao/ui/icons/PlayIcon';
import { SettingsIcon } from '@sikao/ui/icons/SettingsIcon';
import { PanelLeftCloseIcon } from '@sikao/ui/icons/PanelLeftCloseIcon';
import { PanelLeftOpenIcon } from '@sikao/ui/icons/PanelLeftOpenIcon';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import { bodyChars } from '@sikao/answer-engine/word-limit/bodyChars';

interface Props {
  readonly onSubmit: () => void;
  readonly onTogglePause: () => void;
  readonly onSettings: () => void;
  // 04-essay.md L73: 大作文模式可隐藏左栏 ScratchPad ('专注大作文'按钮).
  // Shell 持有 SSOT, Topbar 只负责触发 toggle.
  readonly focusMode?: boolean;
  readonly onToggleFocusMode?: () => void;
  // Wave 9 Phase 2a (2026-05-12): mobile (≤768) 单栏切换. md+ 该 IconBtn 走
  // md:hidden 视觉降级 (双栏视图下不需要 toggle).
  readonly mobileMode?: 'editor' | 'material';
  readonly onToggleMobileMode?: () => void;
}

export function EssayTopbar({
  onSubmit,
  onTogglePause,
  onSettings,
  focusMode = false,
  onToggleFocusMode,
  mobileMode = 'editor',
  onToggleMobileMode,
}: Props) {
  const paper = useExamSession((s) => s.paper);
  const phase = useExamSession((s) => s.phase);
  const textsByQ = useExamSession((s) => s.textsByQ);

  if (!paper) return null;

  const totalChars = textsByQ.reduce((sum, t) => sum + bodyChars(t), 0);
  const isPaused = phase === 'paused';
  const submitting = phase === 'submitting';

  return (
    <header
      className="bg-surface border-b border-line px-3 md:px-5 py-2 md:py-3 flex items-center gap-2 md:gap-3 shrink-0"
      data-testid="essay-topbar"
    >
      <div className="flex flex-col min-w-0">
        <span className="text-tiny font-mono text-ink-4 hidden md:inline">
          {paper.code}
        </span>
        <h2
          className="font-serif text-ink truncate"
          style={{ fontSize: 17, lineHeight: 1.3 }} /* hardcode-allow: 17 between body 15 and h-card 22 */
        >
          {paper.name}
        </h2>
      </div>
      <div className="flex-1" />
      <div
        className="font-mono text-sm tabular-nums text-ink-3"
        data-testid="essay-topbar-total"
      >
        共 {totalChars} 字
      </div>
      {/* Wave 9 Phase 2a (2026-05-12): mobile-only material/editor toggle.
          md:hidden 让 tablet+ 双栏视图下消失 (双栏自动同时显, toggle 无意义). */}
      {onToggleMobileMode ? (
        <div className="md:hidden">
          <Tooltip label={mobileMode === 'editor' ? '查看材料' : '回到答题'}>
            <IconBtn
              aria-label={mobileMode === 'editor' ? '查看材料' : '回到答题'}
              aria-pressed={mobileMode === 'material'}
              variant={mobileMode === 'material' ? 'on' : 'default'}
              onClick={onToggleMobileMode}
              data-testid="essay-topbar-mobile-mode"
            >
              {mobileMode === 'material' ? (
                <PanelLeftCloseIcon size={14} />
              ) : (
                <PanelLeftOpenIcon size={14} />
              )}
            </IconBtn>
          </Tooltip>
        </div>
      ) : null}
      {onToggleFocusMode ? (
        <div className="hidden md:block">
          <Tooltip label={focusMode ? '退出专注模式' : '专注大作文'}>
            <IconBtn
              aria-label={focusMode ? '退出专注模式' : '专注大作文'}
              aria-pressed={focusMode}
              variant={focusMode ? 'on' : 'default'}
              onClick={onToggleFocusMode}
              data-testid="essay-topbar-focus"
            >
              {focusMode ? (
                <PanelLeftOpenIcon size={14} />
              ) : (
                <PanelLeftCloseIcon size={14} />
              )}
            </IconBtn>
          </Tooltip>
        </div>
      ) : null}
      <Tooltip label={isPaused ? '继续作答' : '暂停作答'}>
        <IconBtn
          aria-label={isPaused ? '继续作答' : '暂停作答'}
          onClick={onTogglePause}
          data-testid="essay-topbar-pause"
        >
          {isPaused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
        </IconBtn>
      </Tooltip>
      <Tooltip label="设置">
        <IconBtn
          aria-label="设置"
          onClick={onSettings}
          data-testid="essay-topbar-settings"
        >
          <SettingsIcon size={14} />
        </IconBtn>
      </Tooltip>
      <Button
        variant="primary"
        size="sm"
        leftIcon={<NavSubmitIcon size={16} />}
        onClick={onSubmit}
        disabled={submitting}
        aria-label="提交申论作答"
        data-testid="essay-topbar-submit"
      >
        {submitting ? '提交中…' : '提 交'}
      </Button>
    </header>
  );
}
