import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.2 primitive — 答题卡单个方格。参考 element/preview/answer-grid.html。
// 状态色规范（black/white editorial）:
//   - pending: cream 底 + line 边 + muted 字（未作答）
//   - done:    cream 底 + ink 边 + ink 字（已作答，对错未知）
//   - wrong:   cream 底 + danger 边 + danger 字 + line-through（已作答且错）
//   - current: ink 底 + cream 字 + ink 边（当前题）
// flagged 视觉上整体覆盖 status: 黄色填充 (warn-bg + warn border) 让用户标记
// 的题目醒目 (lhr 决策, 替代之前的右上角弧线/折角 overlay). data-flagged
// attribute 仍 export 让测试 / 调试可断言.
//
// Dumb：不读 store / router；caller 传 number + status，onClick 驱动跳题。

export type AnswerCellStatus = 'pending' | 'done' | 'correct' | 'wrong' | 'current' | 'marked';

export interface AnswerCellProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly number: number | string;
  readonly status?: AnswerCellStatus;
  readonly flagged?: boolean;
}

const STATUS: Record<AnswerCellStatus, string> = {
  pending: 'bg-surface border-line text-ink-3 hover:border-ink hover:text-ink',
  // done: 已答 → accent 蓝 (lhr 决策, 替代之前的 ink 边 cream 底). 设计规范
  // §brand 把蓝降级为 accent 仅 focus / 链接 / key CTA 用, 但答题卡进度反馈
  // 是用户主动操作的可视进度, 跟"key CTA 反馈"一档, 用 accent 合理.
  done: 'bg-accent-50 border-accent text-accent hover:brightness-95',
  correct: 'bg-ok-bg border-ok text-ok hover:brightness-95',
  wrong: 'bg-bad-bg border-err text-err',
  current: 'bg-ink border-ink text-white font-semibold',
  marked: 'bg-warn-bg border-warn text-warn hover:brightness-95',
};

export function AnswerCell({
  number,
  status = 'pending',
  flagged = false,
  className,
  type = 'button',
  ...rest
}: AnswerCellProps) {
  return (
    <button
      type={type}
      className={cn(
        'aspect-square flex items-center justify-center',
        'rounded-tiny',
        'font-medium text-sm tabular-nums',
        'border transition-colors duration-fast ease-motion',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50',
        // flagged 视觉优先覆盖 status (lhr 决策: 黄色填充比角落 overlay 更醒目).
        flagged ? STATUS.marked : STATUS[status],
        className,
      )}
      aria-current={status === 'current' ? 'true' : undefined}
      {...rest}
    >
      {number}
    </button>
  );
}
