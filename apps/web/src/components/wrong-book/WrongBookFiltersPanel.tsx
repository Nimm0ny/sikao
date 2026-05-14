/**
 * SIKAO Wave 4 Phase 2D · 主页 7-chip viewFilter panel.
 *
 * spec: design/SIKAO/handoff/modules/xingce-wrongbook/xingce-wrongbook.html
 *       .filters .fr .fchip MainPage.
 *
 * 7 chip view: all / todo / doing / danger / meek / ok / new
 *
 * 直接 chip 风格 (rounded-tiny, 选中 ink 底 paper 字), 跟 element/fchip 一致.
 * 数量靠 useWrongBookSummary derive (danger/todoCount/graduatedCount/weeklyNew).
 *
 * 把 mastery 三档跟 view filter 合一: chip "全部 / 待重做 / ..." 用户视角更清楚,
 * 不再单独 expose 3 个 mastery checkbox. paperCode chip 走 WrongBook.tsx
 * top-level 显示 (复用现有 logic).
 */
import { memo } from 'react';
import type { WrongBookSummary } from '@sikao/api-client/queries/wrongBookQueries';

// SIKAO Wave 4 Phase 2D viewFilter — 主页 7 视图. BE 暂时只支持 masteryLevel
// (not_mastered / reviewing / mastered), todo/danger/meek/ok/new 走客户端聚合 +
// 后续 endpoint 扩展 (本期不改 BE). UI 上先把 chip 全 expose, 切换时调整 mastery
// + 让 list query 过滤. master 拍板: chip click 走 callback 出去, smart
// container 把 chip → mastery 转换.
export type ViewFilterKey =
  | 'all'
  | 'todo'
  | 'doing'
  | 'danger'
  | 'meek'
  | 'ok'
  | 'new';

interface ChipDef {
  readonly key: ViewFilterKey;
  readonly label: string;
  readonly dot?: boolean;
}

const CHIPS: readonly ChipDef[] = [
  { key: 'all', label: '全部' },
  { key: 'todo', label: '待重做' },
  { key: 'doing', label: '进行中' },
  { key: 'danger', label: '险题', dot: true },
  { key: 'meek', label: '蒙对题' },
  { key: 'ok', label: '已毕业' },
  { key: 'new', label: '本周新增', dot: true },
];

function countFor(key: ViewFilterKey, summary: WrongBookSummary): number {
  switch (key) {
    case 'all':
      return summary.inPractice + summary.graduatedCount;
    case 'todo':
      return summary.todoCount;
    case 'doing':
      return Math.max(0, summary.inPractice - summary.todoCount);
    case 'danger':
      return summary.dangerCount;
    case 'meek':
      // BE 暂不暴露 meek 数 — 用 danger 作 proxy 显示 (后续 endpoint 扩展再换).
      return summary.dangerCount;
    case 'ok':
      return summary.graduatedCount;
    case 'new':
      return summary.weeklyNew;
    default:
      return 0;
  }
}

export interface WrongBookFiltersPanelProps {
  readonly viewFilter: ViewFilterKey;
  readonly onChangeView: (next: ViewFilterKey) => void;
  readonly summary: WrongBookSummary;
}

function WrongBookFiltersPanelImpl({
  viewFilter,
  onChangeView,
  summary,
}: WrongBookFiltersPanelProps) {
  return (
    <section
      className="bg-surface border border-line"
      data-testid="wrong-book-filters-panel"
    >
      <div className="grid grid-cols-[96px_1fr] gap-4 px-6 py-4 items-center">
        <div className="text-tiny font-mono tracking-wider uppercase text-ink-3">
          视图
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="错题视图">
          {CHIPS.map((c) => {
            const active = viewFilter === c.key;
            const count = countFor(c.key, summary);
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeView(c.key)}
                className={
                  'inline-flex items-center gap-2 h-8 px-3 rounded-tiny transition-colors duration-fast text-sm ' +
                  (active
                    ? 'bg-ink text-white'
                    : 'text-ink-3 hover:bg-surface-alt')
                }
                data-testid={`wrong-book-chip-${c.key}`}
              >
                {c.dot === true ? (
                  <span
                    className="w-1.5 h-1.5 rounded-pill bg-exam-accent"
                    data-pattern="dot"
                    aria-hidden="true"
                  />
                ) : null}
                <span>{c.label}</span>
                <span className="font-mono text-xs opacity-60 tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export const WrongBookFiltersPanel = memo(WrongBookFiltersPanelImpl);
