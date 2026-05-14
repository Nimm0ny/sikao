import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.2 primitive — inline pipe-separated nav (filter row).
// 参考 element/preview/tabs-nav.html 的 `.pipes` 组。
//
// 使用：
//   <PipeNav
//     items={[
//       { value: 'all', label: '全部' },
//       { value: 'xingce', label: '行测' },
//       { value: 'shenlun', label: '申论' },
//     ]}
//     value={value}
//     onChange={setValue}
//   />
//
// 与 Tabs 的区别：没有 active 动画 / 不分 variant；inline 只改色 + 加粗。
// 适合次级过滤（如错题本里的科目切换），不承担主导航职责。

export interface PipeNavItem<T extends string = string> {
  readonly value: T;
  readonly label: ReactNode;
  readonly disabled?: boolean;
  readonly testId?: string;
}

export interface PipeNavProps<T extends string = string> {
  readonly items: readonly PipeNavItem<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly className?: string;
  readonly ariaLabel?: string;
}

export function PipeNav<T extends string = string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: PipeNavProps<T>) {
  if (items.length === 0) return null;
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap items-center gap-5 text-sm', className)}
    >
      {items.map((item, idx) => {
        const selected = item.value === value;
        return (
          <Fragment key={item.value}>
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={item.disabled}
              onClick={() => onChange(item.value)}
              data-testid={item.testId}
              className={cn(
                'bg-transparent border-0 p-0 cursor-pointer tracking-[0.02em]', // hardcode-allow: ASCII divider micro-adjust
                'transition-colors duration-fast ease-motion',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:underline underline-offset-4',
                selected ? 'text-ink font-semibold' : 'text-ink-3 hover:text-ink',
              )}
            >
              {item.label}
            </button>
            {idx < items.length - 1 ? (
              <span aria-hidden="true" className="w-px h-2.5 bg-line-3" />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
