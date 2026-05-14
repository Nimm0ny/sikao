import { type ReactElement } from 'react';
import { cn } from '@sikao/shared-utils';
import type { NoteType } from '@sikao/api-client/queries/notebookQueries';

/**
 * SIKAO Wave 4 Phase 2D · TypeTabs — 5 等分 type filter.
 *
 * 设计 SSOT `.nt-tabs`. active → ink 反衬白字, inactive → ink-muted. Tab 5 项:
 * 全部 / 金句 / 方法论 / 反思 / 素材. value=null 表示 "全部".
 *
 * Dumb: caller 持 value + onChange, 内部不 store.
 */

export type TypeTabValue = NoteType | 'all';

interface TabItem {
  readonly value: TypeTabValue;
  readonly index: string;
  readonly label: string;
  readonly desc: string;
}

const TABS: readonly TabItem[] = [
  { value: 'all', index: '00', label: '全部', desc: '跨域单池' },
  { value: 'quote', index: '01', label: '金句', desc: '精彩论述' },
  { value: 'method', index: '02', label: '方法论', desc: '解题套路' },
  { value: 'reflect', index: '03', label: '反思', desc: '失分回顾' },
  { value: 'material', index: '04', label: '素材', desc: '案例库' },
] as const;

export interface TypeTabsProps {
  readonly value: TypeTabValue;
  readonly counts: Partial<Record<NoteType | 'all', number>>;
  readonly onChange: (next: TypeTabValue) => void;
  readonly testId?: string;
}

export function TypeTabs({
  value,
  counts,
  onChange,
  testId,
}: TypeTabsProps): ReactElement {
  return (
    <div
      role="tablist"
      aria-label="笔记类型"
      data-testid={testId ?? 'notes-type-tabs'}
      className={cn(
        'flex items-stretch bg-surface border border-line rounded-card overflow-hidden',
      )}
    >
      {TABS.map((tab, i) => {
        const selected = value === tab.value;
        const count = counts[tab.value] ?? 0;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`notes-type-tab-${tab.value}`}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex-1 px-5 py-4 flex flex-col gap-2 text-left',
              'transition-colors duration-fast ease-motion',
              i < TABS.length - 1 && 'border-r border-line',
              selected
                ? 'bg-ink text-white'
                : 'text-ink-3 hover:bg-surface-alt hover:text-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50 focus-visible:ring-offset-2',
            )}
          >
            <span
              className={cn(
                'font-mono text-tiny tracking-wider uppercase',
                selected ? 'text-ink-4' : 'text-ink-4',
              )}
            >
              {tab.index}
            </span>
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-serif text-lg font-semibold">
                {tab.label}
              </span>
              <span
                className={cn(
                  'font-mono text-sm font-medium tabular-nums',
                  selected ? 'text-ink-4' : 'text-ink-4',
                )}
              >
                {count}
              </span>
            </span>
            <span
              className={cn(
                'text-xs',
                selected ? 'text-ink-4' : 'text-ink-3',
              )}
            >
              {tab.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
