import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.2 primitive — 题目选项行（editorial 风）。
// 参考 element/preview/forms.html 的 `.opt` 列表。
//
// 视觉：
//   - 无卡片背景，只有 border-top hairline 分隔（最后一项补 border-bottom）
//   - serif italic A/B/C/D key
//   - 右侧 radio check 圆点（selected 时 ink 填充）
//   - status 参数用于复盘：correct（绿）/ wrong（红）/ neutral（默认）
//
// Dumb：caller 管 selected / status；onClick 抛给上游。
// 支持键盘：`<button>` 原生 Enter/Space。

export type OptionStatus = 'neutral' | 'correct' | 'wrong';

export interface OptionRowProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** A / B / C / D 或其他 key。渲染为 serif italic。 */
  readonly optionKey: ReactNode;
  /** 选项正文。 */
  readonly text: ReactNode;
  readonly selected?: boolean;
  /** 复盘态染色。答题流用默认 neutral。 */
  readonly status?: OptionStatus;
  /** 是否补 bottom border（最后一行传 true）。 */
  readonly last?: boolean;
}

const STATUS_TEXT: Record<OptionStatus, string> = {
  neutral: 'text-ink',
  correct: 'text-ok',
  wrong: 'text-err',
};

const STATUS_KEY: Record<OptionStatus, string> = {
  neutral: 'text-ink-4',
  correct: 'text-ok',
  wrong: 'text-err',
};

export function OptionRow({
  optionKey,
  text,
  selected = false,
  status = 'neutral',
  last = false,
  disabled,
  className,
  type = 'button',
  ...rest
}: OptionRowProps) {
  const isSel = selected && status === 'neutral';
  return (
    <button
      type={type}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'w-full grid grid-cols-[28px_1fr_20px] items-center gap-4 py-3 px-4',
        'border border-line rounded-card text-left cursor-pointer mb-3 last:mb-0',
        'transition-colors duration-fast ease-motion',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:bg-surface-alt',
        last && 'mb-0',
        status === 'neutral' && !selected && 'hover:text-accent',
        isSel && 'font-semibold bg-paper-2 ring-1 ring-inset ring-ink',
        STATUS_TEXT[status],
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          'font-serif italic font-medium text-lg leading-none',
          isSel ? 'text-ink' : STATUS_KEY[status],
        )}
      >
        {optionKey}
      </span>
      <span className="text-sm leading-relaxed">{text}</span>
      <span
        aria-hidden="true"
        className={cn(
          'justify-self-end mt-1 w-4 h-4 rounded-pill border flex items-center justify-center',
          isSel ? 'bg-ink border-ink' : 'border-line-3',
          status === 'correct' && 'border-ok',
          status === 'wrong' && 'border-err',
        )}
      >
        {isSel ? <span className="w-[6px] h-[6px] rounded-pill bg-white" /> : null}
      </span>
    </button>
  );
}
