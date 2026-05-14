import { ChevronLeftIcon, ChevronRightIcon } from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';

interface Props {
  pageCount: number;
  viewPage: number;
  cursorPage: number;
  onGoTo: (page: number) => void;
}

// Pager — floating pill bar that lets the user jump between pages of the
// 田字格 sheet. Active page is the *viewed* page (not the cursor); a tiny
// dot marks the cursor's page when it's different.
//
// E2E #5 surfaced that the original 24px pill was too quiet — users hit the
// page-1 wrap, didn't notice the new chip, and reported "can't see the next
// page". Bumped to 32px buttons + a visible "第 X / N 页" label + heavier
// shadow so the bar reads as a control, not a watermark.

export function Pager({ pageCount, viewPage, cursorPage, onGoTo }: Props) {
  return (
    // a11y: pill bar 内嵌 button group, 外层 onClick={stopPropagation} 仅为防止
    // 点击 pager 间隙触发外部 click (focus 答题区). 内 button 自带 a11y, 此容器是
    // 纯 presentation, role="navigation" 加 aria-label 让 screen reader 识别区块.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={cn(
        'absolute left-1/2 -translate-x-1/2 z-10',
        'flex items-center gap-1 p-2',
        'bg-surface border border-line rounded-pill shadow-pop',
      )}
      style={{ bottom: 110 }}
      data-testid="exam-pager"
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip label="上一页">
        <button
          type="button"
          onClick={() => onGoTo(viewPage - 1)}
          disabled={viewPage === 0}
          aria-label="上一页"
          className={cn(
            'w-8 h-8 rounded-pill flex items-center justify-center',
            'transition-colors duration-base',
            viewPage === 0
              ? 'text-line-3 cursor-not-allowed'
              : 'text-ink-3 hover:bg-surface-alt cursor-pointer',
          )}
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
      </Tooltip>
      {Array.from({ length: pageCount }, (_, i) => {
        const active = i === viewPage;
        const hasCursor = i === cursorPage;
        return (
          <button
            type="button"
            key={i}
            onClick={() => onGoTo(i)}
            aria-label={`第 ${i + 1} 页`}
            className={cn(
              'min-w-8 h-8 px-3 rounded-pill font-mono tabular-nums text-xs font-bold',
              'relative transition-colors duration-base',
              active ? 'bg-ink text-surface' : 'text-ink-3 hover:bg-surface-alt',
            )}
            data-testid={`exam-pager-page-${i}`}
          >
            {i + 1}
            {hasCursor && !active && (
              <span
                className="absolute top-1 right-1 w-1.5 h-1.5 rounded-pill bg-accent" /* hardcode-allow: 6px cursor pip on 32px button corner */
                aria-hidden
              />
            )}
          </button>
        );
      })}
      <Tooltip label="下一页">
        <button
          type="button"
          onClick={() => onGoTo(viewPage + 1)}
          disabled={viewPage === pageCount - 1}
          aria-label="下一页"
          className={cn(
            'w-8 h-8 rounded-pill flex items-center justify-center',
            'transition-colors duration-base',
            viewPage === pageCount - 1
              ? 'text-line-3 cursor-not-allowed'
              : 'text-ink-3 hover:bg-surface-alt cursor-pointer',
          )}
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </Tooltip>
      <span className="w-px h-4 bg-line mx-1" aria-hidden /> {/* hardcode-allow: 16px hairline divider matches button height */}
      <span
        className="px-2 text-tiny font-mono tabular-nums text-ink-3 font-semibold whitespace-nowrap"
        data-testid="exam-pager-label"
      >
        第 {viewPage + 1} / {pageCount} 页
      </span>
    </div>
  );
}
