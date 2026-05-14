/**
 * ResultTabNav — Result view 长滚屏 sticky tab nav.
 *
 * P4 audit P0-6: Result 5+屏纵向, 用户找信息困难.
 * sticky 在 ScoreHero 下方, click 跳 anchor section, scroll-spy 同步 active.
 *
 * 调性: ink-first / hairline / 不打鸡血. 走 brand v2 token.
 */
import { type ReactNode } from 'react';

export interface ResultTabItem {
  /** anchor id (DOM section id) */
  id: string;
  /** 中文 label */
  label: string;
}

export interface ResultTabNavProps {
  tabs: ReadonlyArray<ResultTabItem>;
  activeId: string;
  onTabClick?: (id: string) => void;
  /** 子内容 (罕见, 占位) */
  children?: ReactNode;
}

export function ResultTabNav({ tabs, activeId, onTabClick }: ResultTabNavProps) {
  return (
    <nav
      role="tablist"
      aria-label="结果分页导航"
      data-testid="result-tab-nav"
      className="sticky top-0 z-30 -mx-4 md:-mx-6 mb-4 backdrop-blur-sm border-b border-line bg-paper/80"
    >
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = activeId === tab.id;
          return (
            <a
              key={tab.id}
              role="tab"
              aria-selected={active}
              aria-controls={`section-${tab.id}`}
              href={`#${tab.id}`}
              onClick={(e) => {
                if (onTabClick !== undefined) {
                  e.preventDefault();
                  onTabClick(tab.id);
                }
              }}
              data-testid={`result-tab-${tab.id}`}
              className={[
                'px-3 py-2 text-sm whitespace-nowrap transition-colors',
                'border-b-2 -mb-px',
                active
                  ? 'border-ink text-ink font-medium'
                  : 'border-transparent text-ink-3 hover:text-ink',
              ].join(' ')}
            >
              {tab.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
