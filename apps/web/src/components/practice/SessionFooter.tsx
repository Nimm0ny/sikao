import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@sikao/shared-utils';
import { NavNextIcon, NavPrevIcon } from '@sikao/ui/icons';

// Phase 3.1 fenbi-merge — SessionFooter 已大幅简化. 主操作 (timer / 标记 /
// 答题卡 / 交卷 / 暂停 / 退出) 全部上提到 SessionHeader. footer 只剩 deck
// 模式翻页 prev/next 大箭头 + 进度文案. scroll 模式 (Wave D) 下 caller 不
// 渲染 footer.

export interface SessionFooterProps {
  readonly progressLabel: string;
  readonly prevDisabled: boolean;
  readonly nextDisabled: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly className?: string;
}

export function SessionFooter({
  progressLabel,
  prevDisabled,
  nextDisabled,
  onPrev,
  onNext,
  className,
}: SessionFooterProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 mt-auto',
        'flex items-center justify-between gap-4 px-4 md:px-6 py-3',
        // Wave D review-fix #2: 给 AnswerCardStickyTab 让位 (左下角 fixed).
        // mobile tab ~70px wide → pl-20; desktop tab ~120px wide → md:pl-32.
        'pl-20 md:pl-32',
        'border-t border-line bg-surface',
        className,
      )}
      data-testid="session-footer"
    >
      <NavButton label="上一题" disabled={prevDisabled} onClick={onPrev} data-testid="session-footer-prev">
        <NavPrevIcon size={20} />
        上一题
      </NavButton>
      <span className="text-xs text-ink-3 tabular-nums">{progressLabel}</span>
      <NavButton
        label="下一题"
        disabled={nextDisabled}
        onClick={onNext}
        data-testid="session-footer-next"
        align="end"
      >
        下一题
        <NavNextIcon size={20} />
      </NavButton>
    </div>
  );
}

interface NavButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string;
  readonly align?: 'start' | 'end';
}

function NavButton({ label, align = 'start', className, children, ...rest }: NavButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-tiny border border-line bg-surface px-4 text-sm font-medium text-ink-3',
        'hover:bg-surface-alt hover:text-ink transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:cursor-not-allowed disabled:opacity-45',
        align === 'end' ? 'flex-row' : 'flex-row',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
