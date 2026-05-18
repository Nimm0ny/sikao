import type { ReactNode } from 'react';
import { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@sikao/shared-utils';
import { MOTION_SPRING_SOFT } from '@sikao/shared-utils';

// Phase 5.1 rebrand: Tabs gains `variant: 'pill' | 'underline'` per
// element/preview/tabs-nav.html.
//   - pill (default, phase 4.2): 圆角底 motion layoutId 背景，保留。
//   - underline: hairline 底边 + active 态 2px 下划线（element 默认），
//     TabItem 可附 `count` 显示 serif italic 数字。
//
// Dumb by contract: active key 和 click handler 在 caller；Tab 不改 URL / store。

export interface TabItem<T extends string = string> {
  readonly value: T;
  readonly label: ReactNode;
  readonly disabled?: boolean;
  /** element underline 变体里用的 serif italic 数字，如错题数量 count=42。 */
  readonly count?: number | string;
  // `frontend/CLAUDE.md §2.7` 要求关键交互按钮挂 data-testid，供 Harness smoke
  // 消费。Tab 是通用组件，caller 为每个 item 指定具体 id。
  readonly testId?: string;
}

export type TabsVariant = 'pill' | 'underline';

export interface TabsProps<T extends string = string> {
  readonly items: readonly TabItem<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly variant?: TabsVariant;
  readonly className?: string;
  readonly ariaLabel?: string;
}

// —— pill 变体（phase 4.2 原有样式）——
const PILL_BASE =
  'relative px-3 py-2 rounded-tiny text-sm font-medium cursor-pointer ' +
  'transition-colors disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50';
const PILL_INACTIVE = 'text-ink-3 hover:text-accent hover:bg-accent-50';
const PILL_ACTIVE_TEXT = 'text-white';

// —— underline 变体（element spec）——
const UNDER_BASE =
  'relative px-0 py-4 text-md cursor-pointer transition-colors ' +
  'disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:underline underline-offset-8';
const UNDER_INACTIVE = 'text-ink-3 hover:text-accent font-medium';
const UNDER_ACTIVE = 'text-accent font-semibold';

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = 'pill',
  className,
  ariaLabel,
}: TabsProps<T>) {
  const instanceId = useId();
  const layoutId = `tabs-indicator-${instanceId}`;

  if (variant === 'underline') {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn('flex items-baseline gap-9 border-b border-line', className)}
      >
        {items.map(item => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={item.disabled}
              onClick={() => onChange(item.value)}
              className={cn(UNDER_BASE, selected ? UNDER_ACTIVE : UNDER_INACTIVE)}
              data-testid={item.testId}
            >
              <span>{item.label}</span>
              {item.count != null ? (
                <span
                  className={cn(
                    'ml-2 font-serif italic',
                    selected ? 'text-accent' : 'text-ink-4',
                  )}
                >
                  {item.count}
                </span>
              ) : null}
              {selected ? (
                <motion.span
                  layoutId={layoutId}
                  className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-accent" // hardcode-allow: motion underline overlay 到 border-b 1px 上
                  transition={MOTION_SPRING_SOFT}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  // default: pill
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-1', className)}
    >
      {items.map(item => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(PILL_BASE, selected ? PILL_ACTIVE_TEXT : PILL_INACTIVE)}
            data-testid={item.testId}
          >
            {selected ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-tiny bg-accent"
                transition={MOTION_SPRING_SOFT}
                aria-hidden="true"
              />
            ) : null}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
