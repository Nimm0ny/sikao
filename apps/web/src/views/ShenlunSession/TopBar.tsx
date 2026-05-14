import type { ReactElement } from 'react';
import { IconBtn } from '@sikao/ui/ui/IconBtn';
import { Button } from '@sikao/ui/ui/Button';
import { Tooltip } from '@sikao/ui/ui/Tooltip';
import { NavBackIcon } from '@sikao/ui/icons/NavBackIcon';
import { NavPrevIcon } from '@sikao/ui/icons/NavPrevIcon';
import { NavNextIcon } from '@sikao/ui/icons/NavNextIcon';
import { NavSubmitIcon } from '@sikao/ui/icons/NavSubmitIcon';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy';
import { cn } from '@sikao/shared-utils';

// ShenlunSession/TopBar (PR13 P2, 2026-05-13) — 60px 单行 TD1 顶条.
//
// Spec SSOT: docs/design/handoff/Shenlun & Tablet Refinements · Handoff.md §2.3
// + docs/design/Mobile and Tablet Pack New.html line 2229-2240.
//
// 元素左→右: 退出 IconBtn / 模拟标识 / 计时 / 字数 / 保存态 / spacer / 上一题 /
//            下一题 / 提交批改 (主 CTA — SVG + 文字双形态, 走 CLAUDE.md §4 例外).
//
// 设计决策:
//   - 不复用 components/practice/PracticeTimer: 其视觉是 bg-surface-alt 卡片
//     + ClockIcon 前缀, 跟 TD1 spec "纯 tabular-nums 大字" 不匹配. 这里手写
//     一个 mm:ss 内联格式器即可 (≤10 行 helper). 不值得拉 ClockIcon 整套.
//   - 退出按钮用 NavBackIcon (arrow-left + 竖杠), 跟 spec arrow-only 等效但更
//     清晰 (设计稿原始 svg 是 arrow-only). 这里选 NavBackIcon 让"退出"语义
//     视觉更强 (P3 P4 在 sidebar 顶部退出行才用更轻的 ChevronLeft).
//   - Tooltip 包所有 IconBtn 让 hover/focus 浮出中文动作 (CLAUDE.md §4 IconBtn
//     SVG-only 铁律配套).
//   - 主 CTA 提交走 <Button variant="primary" leftIcon={NavSubmitIcon}> — 沿用
//     EssayTopbar.tsx 已落地的同款 SVG + 文字模式 (CLAUDE.md §4 主 CTA 例外).

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

export interface TopBarProps {
  readonly examLabel: string;
  readonly elapsedSeconds: number;
  readonly currentWordCount: number;
  readonly maxWordCount: number;
  readonly saveStatus: SaveStatus;
  readonly onExit: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onSubmit: () => void;
  readonly canPrev?: boolean;
  readonly canNext?: boolean;
  readonly className?: string;
}

function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

const SAVE_TEXT: Record<SaveStatus, string> = {
  saved: ESSAY_SIKAO_COPY.topbarSaveStatusSaved,
  saving: ESSAY_SIKAO_COPY.topbarSaveStatusSaving,
  unsaved: ESSAY_SIKAO_COPY.topbarSaveStatusUnsaved,
};

// 状态点颜色: saved → ok, saving → warn (in-flight), unsaved → ink-3 (中性灰,
// 不喧宾夺主). 不用 err — "未保存"不是错误态, 只是 pending.
const SAVE_DOT: Record<SaveStatus, string> = {
  saved: 'bg-ok',
  saving: 'bg-warn',
  unsaved: 'bg-ink-3',
};

const SEPARATOR = (
  <span
    aria-hidden="true"
    className="inline-block w-px h-4 bg-line-2 shrink-0"
  />
);

export default function TopBar({
  examLabel,
  elapsedSeconds,
  currentWordCount,
  maxWordCount,
  saveStatus,
  onExit,
  onPrev,
  onNext,
  onSubmit,
  canPrev = true,
  canNext = true,
  className,
}: TopBarProps): ReactElement {
  const elapsedText = formatElapsed(elapsedSeconds);
  const saveText = SAVE_TEXT[saveStatus];
  const saveDot = SAVE_DOT[saveStatus];

  return (
    <header
      data-testid="shenlun-topbar"
      className={cn(
        'flex items-center gap-3 px-5 border-b border-line-1 bg-paper-1 shrink-0',
        className,
      )}
      style={{ height: 60 }} /* hardcode-allow: spec TD1 §2.3 顶条高度 60px 写死 */
    >
      <Tooltip label={ESSAY_SIKAO_COPY.topbarExitFocus}>
        <IconBtn
          aria-label={ESSAY_SIKAO_COPY.topbarExitFocus}
          onClick={onExit}
          data-testid="shenlun-topbar-exit"
        >
          <NavBackIcon size={16} />
        </IconBtn>
      </Tooltip>
      <span
        className="font-serif text-ink-3 whitespace-nowrap shrink-0"
        style={{ fontSize: 12 }} /* hardcode-allow: spec §2.3 模拟标识 12px (--t-meta) */
        data-testid="shenlun-topbar-exam-label"
      >
        {examLabel}
      </span>
      {SEPARATOR}
      <span
        role="timer"
        aria-label={`${ESSAY_SIKAO_COPY.topbarElapsedAriaLabel} ${elapsedText}`}
        className="font-mono font-semibold tabular-nums text-ink shrink-0"
        style={{ fontSize: 20 }} /* hardcode-allow: spec §2.3 计时器 20px 大字, 介于 --t-h3 18 与 --t-h2 24 */
        data-testid="shenlun-topbar-timer"
      >
        {elapsedText}
      </span>
      {SEPARATOR}
      <span
        className="inline-flex items-baseline gap-1 shrink-0"
        data-testid="shenlun-topbar-wordcount"
      >
        <span
          className="font-mono font-semibold tabular-nums text-ink"
          style={{ fontSize: 14 }} /* hardcode-allow: --t-body 14, current count */
        >
          {currentWordCount}
        </span>
        <span
          className="font-serif text-ink-4 tabular-nums"
          style={{ fontSize: 11 }} /* hardcode-allow: --t-tiny 11, max ratio */
        >
          / {maxWordCount}
        </span>
      </span>
      <span
        className="inline-flex items-center gap-2 font-serif text-ink-3 shrink-0"
        style={{ fontSize: 11 }} /* hardcode-allow: --t-tiny 11 save badge */
        data-testid="shenlun-topbar-save"
        data-save-status={saveStatus}
      >
        <span
          aria-hidden="true"
          className={cn('inline-block w-1.5 h-1.5 rounded-pill', saveDot)}
        />
        <span>{saveText}</span>
      </span>
      <div className="flex-1" />
      <Tooltip label={ESSAY_SIKAO_COPY.topbarPrevQuestion}>
        <IconBtn
          aria-label={ESSAY_SIKAO_COPY.topbarPrevQuestion}
          onClick={onPrev}
          disabled={!canPrev}
          data-testid="shenlun-topbar-prev"
        >
          <NavPrevIcon size={16} />
        </IconBtn>
      </Tooltip>
      <Tooltip label={ESSAY_SIKAO_COPY.topbarNextQuestion}>
        <IconBtn
          aria-label={ESSAY_SIKAO_COPY.topbarNextQuestion}
          onClick={onNext}
          disabled={!canNext}
          data-testid="shenlun-topbar-next"
        >
          <NavNextIcon size={16} />
        </IconBtn>
      </Tooltip>
      <Button
        variant="primary"
        size="sm"
        leftIcon={<NavSubmitIcon size={16} />}
        onClick={onSubmit}
        aria-label={ESSAY_SIKAO_COPY.topbarSubmitGrade}
        data-testid="shenlun-topbar-submit"
      >
        {ESSAY_SIKAO_COPY.topbarSubmitGrade}
      </Button>
    </header>
  );
}
