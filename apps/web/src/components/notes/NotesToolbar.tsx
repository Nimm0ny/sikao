import { type ReactElement } from 'react';
import { cn } from '@sikao/shared-utils';
import type { NoteSourceDomain } from '@sikao/api-client/queries/notebookQueries';

/**
 * SIKAO Wave 4 Phase 2D · NotesToolbar — filter / sort / search.
 *
 * 设计 SSOT `.nt-toolbar` + SourceFilter 跨域 (memory plan §3 决策).
 * 简版 layout: search input | source filter chip row | sort select.
 *
 * Dumb: caller 持所有 state. 复杂 view-toggle (grid/list/timeline) 推 Phase 5.
 */

export type SortMode = 'created-desc' | 'updated-desc';

export interface NotesToolbarProps {
  readonly search: string;
  readonly onSearchChange: (next: string) => void;
  readonly sourceDomain: NoteSourceDomain | 'all';
  readonly onSourceDomainChange: (next: NoteSourceDomain | 'all') => void;
  readonly sortMode: SortMode;
  readonly onSortModeChange: (next: SortMode) => void;
  readonly sourceCounts: { readonly all: number; readonly xingce: number; readonly essay: number };
  readonly testId?: string;
}

const SOURCE_OPTS: ReadonlyArray<{
  value: NoteSourceDomain | 'all';
  label: string;
  countKey: 'all' | 'xingce' | 'essay';
}> = [
  { value: 'all', label: '全部', countKey: 'all' },
  { value: 'xingce', label: '行测', countKey: 'xingce' },
  { value: 'essay', label: '申论', countKey: 'essay' },
];

export function NotesToolbar({
  search,
  onSearchChange,
  sourceDomain,
  onSourceDomainChange,
  sortMode,
  onSortModeChange,
  sourceCounts,
  testId,
}: NotesToolbarProps): ReactElement {
  return (
    <section
      data-testid={testId ?? 'notes-toolbar'}
      className={cn(
        'bg-surface border border-line rounded-card',
        'flex flex-wrap items-center gap-3 px-3 py-2',
      )}
    >
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        data-testid="notes-toolbar-search"
        placeholder="搜索笔记标题 / 内容 / 来源"
        aria-label="搜索笔记"
        className={cn(
          'flex-1 min-w-[180px] px-3 py-2 bg-transparent border border-line rounded-tiny',
          'font-sans text-sm text-ink placeholder:text-ink-4',
          'focus-visible:outline-none focus-visible:border-ink',
        )}
      />

      <div
        role="radiogroup"
        aria-label="学习域筛选"
        className="flex items-center gap-1"
      >
        {SOURCE_OPTS.map((opt) => {
          const selected = sourceDomain === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`notes-toolbar-source-${opt.value}`}
              onClick={() => onSourceDomainChange(opt.value)}
              className={cn(
                'px-3 py-2 font-mono text-tiny tracking-wider uppercase rounded-tiny',
                'transition-colors duration-fast ease-motion border',
                selected
                  ? 'bg-ink text-white border-ink'
                  : 'bg-transparent text-ink-3 border-line hover:border-line-3 hover:text-ink',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50 focus-visible:ring-offset-2',
              )}
            >
              {opt.label}
              <span className="ml-1 text-ink-4">
                {sourceCounts[opt.countKey]}
              </span>
            </button>
          );
        })}
      </div>

      <select
        value={sortMode}
        onChange={(e) => {
          const v = e.target.value === 'updated-desc' ? 'updated-desc' : 'created-desc';
          onSortModeChange(v);
        }}
        data-testid="notes-toolbar-sort"
        aria-label="排序"
        className={cn(
          'px-3 py-2 bg-transparent border border-line rounded-tiny',
          'font-mono text-tiny tracking-loose text-ink-3',
          'focus-visible:outline-none focus-visible:border-ink',
        )}
      >
        <option value="created-desc">按创建时间</option>
        <option value="updated-desc">按更新时间</option>
      </select>
    </section>
  );
}
