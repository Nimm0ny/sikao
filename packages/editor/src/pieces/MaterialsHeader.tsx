import { forwardRef } from 'react';
import { SettingsIcon, ToolSearchIcon, XCloseIcon } from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';

interface Props {
  count: number;
  query: string;
  setQuery: (q: string) => void;
  drawerOpen: boolean;
  toggleDrawer: () => void;
  overview: boolean;
  toggleOverview: () => void;
  wide: boolean;
  toggleWide: () => void;
}

// MaterialsHeader — title row + collapsible drawer (search input,
// 总览 / 拉宽 chips, shortcut hints). Forwards a ref to the search input
// so ⌘F (handled in ExamShell) can focus it after opening the drawer.

export const MaterialsHeader = forwardRef<HTMLInputElement, Props>(function MaterialsHeader(
  { count, query, setQuery, drawerOpen, toggleDrawer, overview, toggleOverview, wide, toggleWide },
  searchInputRef,
) {
  return (
    <div className="shrink-0">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-ink tracking-wide font-serif">给定资料</span>
          <span className="text-tiny text-ink-4 font-mono">{count} 篇</span>
          {query.trim() && (
            <span
              className={cn(
                'text-tiny text-warn px-2 py-px rounded-pill bg-warn-bg font-semibold',
                'inline-flex items-center gap-1 exam-ink-fade',
              )}
              data-testid="exam-materials-search-chip"
            >
              搜:&nbsp;{query.trim()}
              <Tooltip label="清除搜索">
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-warn cursor-pointer"
                  aria-label="清除搜索"
                >
                  <XCloseIcon className="w-2.5 h-2.5" />
                </button>
              </Tooltip>
            </span>
          )}
        </div>
        <Tooltip label="工具:搜索 / 总览 / 拉宽">
          <button
            type="button"
            onClick={toggleDrawer}
            aria-label="打开材料工具"
            className={cn(
              'w-7 h-7 rounded-tiny border cursor-pointer',
              'flex items-center justify-center transition-all duration-base',
              drawerOpen
                ? 'border-ink bg-ink text-surface rotate-[60deg]'
                : 'border-line bg-surface text-ink-3 hover:bg-surface-alt hover:rotate-[60deg]',
            )}
            data-testid="exam-materials-drawer-toggle"
            aria-expanded={drawerOpen}
          >
            <SettingsIcon className="w-3 h-3" />
          </button>
        </Tooltip>
      </div>

      <div
        className={cn(
          'overflow-hidden shrink-0',
          'transition-[max-height,opacity] duration-slow',
        )}
        style={{
          maxHeight: drawerOpen ? 220 : 0,
          opacity: drawerOpen ? 1 : 0,
        }}
        aria-hidden={!drawerOpen}
        data-testid="exam-materials-drawer"
      >
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div className="relative">
            <ToolSearchIcon
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-4 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索全部材料"
              aria-label="搜索全部材料"
              className={cn(
                'w-full px-3 py-2 pl-8 text-xs border border-line rounded-tiny outline-none',
                'bg-surface-alt font-sans focus:border-accent',
              )}
              data-testid="exam-materials-search-input"
            />
            {query && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2">
                <Tooltip label="清除搜索">
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="text-ink-4 cursor-pointer"
                    aria-label="清除搜索"
                  >
                    <XCloseIcon className="w-3 h-3" />
                  </button>
                </Tooltip>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Tooltip label={overview ? '关闭材料总览' : '打开材料总览'}>
              <button
                type="button"
                onClick={toggleOverview}
                aria-label={overview ? '关闭材料总览' : '打开材料总览'}
                className={cn(
                  'flex-1 px-2 py-2 rounded-tiny border text-xs font-semibold cursor-pointer',
                  'transition-colors duration-base inline-flex items-center justify-center gap-1',
                  overview
                    ? 'border-accent bg-accent-50 text-accent'
                    : 'border-line bg-surface text-ink-3 hover:bg-surface-alt',
                )}
                data-testid="exam-materials-overview-toggle"
              >
                <ToolSearchIcon className="w-3 h-3" />
              </button>
            </Tooltip>
            <Tooltip label={wide ? '收回标准宽度' : '拉宽材料栏'}>
              <button
                type="button"
                onClick={toggleWide}
                aria-label={wide ? '收回标准宽度' : '拉宽材料栏'}
                className={cn(
                  'flex-1 px-2 py-2 rounded-tiny border text-xs font-semibold cursor-pointer',
                  'transition-colors duration-base inline-flex items-center justify-center gap-1',
                  wide
                    ? 'border-accent bg-accent-50 text-accent'
                    : 'border-line bg-surface text-ink-3 hover:bg-surface-alt',
                )}
                data-testid="exam-materials-wide-toggle"
              >
                <SettingsIcon className="w-3 h-3" />
              </button>
            </Tooltip>
          </div>
          <div className="text-tiny text-ink-4 leading-relaxed">
            ⌘F 搜索 · ⌘O 总览 · ⌘. 拉宽
          </div>
        </div>
      </div>
    </div>
  );
});
