import { cn } from '@sikao/shared-utils';
import { IconBtn, Tooltip } from '@sikao/ui/ui';
import {
  NavAnswerCardIcon,
  NavNextIcon,
  NavPrevIcon,
  NavSubmitIcon,
} from '@sikao/ui/icons';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// SIKAO Wave 4 Phase 2A (2026-05-12): 行测答题 sticky 底部 dock — 集中放置
// "上一题 / 题号 / 下一题 / 答题卡 / 提交" 5 个核心 nav 入口.
//
// 设计 SSOT: docs/plan/sikao-module-sikao-redesign-2026-05-11.md (Wave 4
// xingce-exam P0). 跟 FbTopbar 配合: top 留 timer + 进度 + pause / settings;
// 底部 dock 承载手部触手可及的 nav (移动设备拇指区 + desktop 收口).
//
// 视觉:
//   - height 56px, sticky bottom z-50
//   - bg var(--paper-1), border-t var(--line-2)
//   - padding 24px (px-6), items-center justify-between
//   - 5 IconBtn 32×32 横向排, 中间题号文字 mono tabular-nums
//
// a11y (CLAUDE.md §4 答题系统按钮 SVG-only 铁律):
//   - 每个 IconBtn aria-label 中文 + Tooltip primitive (非 native title)
//   - disabled 走 opacity-50 + cursor-not-allowed (IconBtn base 已含)
//
// Dumb by contract (frontend/CLAUDE.md §2.2): 不读 store / 路由; 全 callback 由 caller.

export interface FbBottomDockProps {
  /** 当前题号 (1-based, 用于"第 N 题 / total"显示 + prev disabled 判定) */
  readonly currentIndex: number;
  /** 总题数 */
  readonly totalQuestions: number;
  /** 上一题 — currentIndex=1 时 disabled */
  readonly onPrev: () => void;
  /** 下一题 — currentIndex=totalQuestions 时 disabled */
  readonly onNext: () => void;
  /** 打开答题卡 drawer */
  readonly onOpenDrawer: () => void;
  /** 提交 — 走 BlockedSubmitGuard, isSubmitting=true 时 disabled */
  readonly onSubmit: () => void;
  /** 提交 in-flight 标记 (从 caller ui state 透传, IconBtn disabled + aria-busy) */
  readonly isSubmitting?: boolean;
}

export function FbBottomDock({
  currentIndex,
  totalQuestions,
  onPrev,
  onNext,
  onOpenDrawer,
  onSubmit,
  isSubmitting = false,
}: FbBottomDockProps) {
  const isFirst = currentIndex <= 1;
  const isLast = currentIndex >= totalQuestions;
  return (
    <nav
      className={cn(
        // Wave 9 Phase 2a (2026-05-12): mobile px-4 紧凑 + pb-safe iOS home indicator;
        // tablet+ px-6 维持现状. h-14 三档不变 (拇指触手最小命中区).
        'sticky bottom-0 z-50 flex items-center justify-between gap-3 md:gap-4',
        'h-14 px-4 md:px-6 pb-safe bg-paper border-t border-line',
      )}
      role="toolbar"
      aria-label="答题导航"
      data-testid="practice-bottom-dock"
    >
      <Tooltip label="上一题 · ←">
        <IconBtn
          size="sm"
          aria-label="上一题"
          onClick={onPrev}
          disabled={isFirst}
          data-testid="practice-bottom-dock-prev"
        >
          <NavPrevIcon size={16} />
        </IconBtn>
      </Tooltip>
      <span
        className={cn(
          'flex-1 text-center font-mono text-sm tabular-nums tracking-loose',
          'text-ink',
        )}
        data-testid="practice-bottom-dock-question-count"
        aria-live="polite"
      >
        第 <span className="font-medium">{currentIndex}</span> 题 / {totalQuestions}
      </span>
      <Tooltip label="下一题 · →">
        <IconBtn
          size="sm"
          aria-label="下一题"
          onClick={onNext}
          disabled={isLast}
          data-testid="practice-bottom-dock-next"
        >
          <NavNextIcon size={16} />
        </IconBtn>
      </Tooltip>
      <Tooltip label="答题卡 · A">
        <IconBtn
          size="sm"
          aria-label={PRACTICE_COPY.fbBottomDockOpenCard}
          onClick={onOpenDrawer}
          data-testid="practice-bottom-dock-open-drawer"
        >
          <NavAnswerCardIcon size={16} />
        </IconBtn>
      </Tooltip>
      <Tooltip label="提交答题">
        <IconBtn
          size="sm"
          variant="primary"
          aria-label="提交答题"
          aria-busy={isSubmitting || undefined}
          onClick={onSubmit}
          disabled={isSubmitting}
          data-testid="practice-bottom-dock-submit"
        >
          <NavSubmitIcon size={16} />
        </IconBtn>
      </Tooltip>
    </nav>
  );
}
