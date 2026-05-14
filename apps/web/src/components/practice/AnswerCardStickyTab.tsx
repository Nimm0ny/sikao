import { NavAnswerCardIcon } from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';

// Phase 3.2 Wave D fenbi-merge — 答题卡 sticky tab.
//
// 桌面: 左下贴边 (fixed left:0 bottom:0 h-11 ~120px wide), 右上角圆角.
//   内容: [答题卡 N/M ▲]. SessionFooter 通过 md:pl-32 让位 (review-fix #2).
// Mobile: 收紧 — 仅 [N/M ▲] (~70px wide), SessionFooter 通过 pl-20 让位.
//   "答题卡"文字 sm:inline 隐藏. 跟 prototype mobile 全宽 bar 设计存在差异 —
//   全宽 bar 会盖住 mobile footer prev/next, 这里采取"贴左收紧"折中.
//
// hidden 时(panel 打开) 不渲染, 不是 visibility:hidden — panel 上有自己的关闭
// 按钮, tab 只在 panel 关闭态出现.

export interface AnswerCardStickyTabProps {
  readonly answeredCount: number;
  readonly totalCount: number;
  readonly hidden?: boolean;
  readonly onClick: () => void;
  readonly className?: string;
}

export function AnswerCardStickyTab({
  answeredCount,
  totalCount,
  hidden = false,
  onClick,
  className,
}: AnswerCardStickyTabProps) {
  if (hidden) return null;
  const label = `展开答题卡, 已答 ${answeredCount} / ${totalCount}`;
  return (
    <Tooltip label="展开答题卡" side="top">
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'fixed left-0 bottom-0 z-20 inline-flex items-center gap-2 sm:gap-3 h-11 pl-3 pr-3 sm:pl-6 sm:pr-5',
        'bg-surface border border-line border-l-0 border-b-0 rounded-tr-card',
        'shadow-card text-sm text-ink hover:bg-surface-alt transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className,
      )}
      data-testid="answer-card-sticky-tab"
    >
      <NavAnswerCardIcon size={16} className="text-ink-3" />
      <span className="font-mono text-xs text-ink-3 tabular-nums">
        {answeredCount}/{totalCount}
      </span>
      {/* inline expand chevron — SIKAO icon spec stroke 1.4 / round caps */}
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-ink-3"
        aria-hidden="true"
      >
        <path d="M6 15l6-6 6 6" />
      </svg>
    </button>
    </Tooltip>
  );
}
