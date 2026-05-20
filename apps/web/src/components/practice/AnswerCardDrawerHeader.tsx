// 答题卡 panel 顶部 header.
//
// Wave 4 Phase 2A (2026-05-12): 扩 progress big number + progress bar + 4 dot legend.
// 关闭按钮由 AnswerCardPanel 自身的 X 提供, 此 header 不再背负 close 职责
// (Wave D 重构: 老 Drawer 时代 header 内置 close, 新 panel 走 panel-close
// testid, 双 close 入口冗余去除).
//
// 名字保留 "DrawerHeader" 是为了 commit history 可追溯; 实际它已被 panel 用.
//
// 设计 SSOT: docs/plan/sikao-module-sikao-redesign-2026-05-11.md (Wave 4
// xingce-exam P0). 顶部 layout:
//   - 标题行: "答题卡" + 大数字 "已答 N / 总数 M" (mono tabular 22px)
//   - progress bar: 3px height, bg var(--line-2), fill var(--exam-accent)
//   - legend 4 dot (2 cols grid): 未答 / 已答 / 已标记 / 当前

import { cn } from '@sikao/shared-utils';
import { PRACTICE_COPY } from '@/lib/ui-copy';

export interface AnswerCardDrawerHeaderProps {
  readonly answeredCount: number;
  readonly totalCount: number;
}

export function AnswerCardDrawerHeader({
  answeredCount,
  totalCount,
}: AnswerCardDrawerHeaderProps) {
  // totalCount=0 防御: 题量 0 时 progress 0%, 避免 NaN/Infinity.
  const ratio =
    totalCount > 0 ? Math.min(1, Math.max(0, answeredCount / totalCount)) : 0;
  const fillPercent = Math.round(ratio * 100);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h-card font-bold text-ink">答题卡</h2>
        <span
          className="font-mono text-2xl tabular-nums tracking-loose text-ink"
          data-testid="answer-card-panel-progress"
        >
          已答 <b className="font-medium">{answeredCount}</b>{' '}
          <span className="text-ink-3">/ 总数 {totalCount}</span>
        </span>
      </div>
      <div
        className="relative h-[3px] w-full overflow-hidden rounded-pill bg-line"
        role="progressbar"
        aria-valuenow={answeredCount}
        aria-valuemin={0}
        aria-valuemax={totalCount}
        aria-label={`已答 ${answeredCount} 题, 总共 ${totalCount} 题`}
        data-testid="answer-card-progress-bar"
      >
        <div
          className="h-full bg-exam-accent transition-all duration-base ease-motion"
          style={{ width: `${fillPercent}%` }}
          data-testid="answer-card-progress-fill"
        />
      </div>
      <ul
        className="grid grid-cols-2 gap-x-3 gap-y-2 pt-3 border-t border-line"
        aria-label={PRACTICE_COPY.drawerLegend}
        data-testid="answer-card-legend"
      >
        <LegendDot kind="pending" label="未答" />
        <LegendDot kind="done" label="已答" />
        <LegendDot kind="marked" label="已标记" />
        <LegendDot kind="current" label="当前" />
      </ul>
    </div>
  );
}

type LegendKind = 'pending' | 'done' | 'marked' | 'current';

interface LegendDotProps {
  readonly kind: LegendKind;
  readonly label: string;
}

// 4 状态点 — 14×14 圆, 颜色全走 token (CLAUDE.md §4 design token SSOT).
// 未答: border rule-strong / 已答: fill ink / 已标记: border exam-accent /
// 当前: fill exam-accent. SVG 显式宽高 14px 避免 lint:radius `rounded-full`
// pattern check (`data-pattern="dot"`).
const DOT_CLASS: Record<LegendKind, string> = {
  pending: 'border border-line-3',
  done: 'bg-ink',
  marked: 'border border-exam-accent',
  current: 'bg-exam-accent',
};

function LegendDot({ kind, label }: LegendDotProps) {
  return (
    <li className="flex items-center gap-2 text-sm text-ink-3">
      <span
        aria-hidden="true"
        data-pattern="dot"
        data-testid={`answer-card-legend-${kind}`}
        className={cn(
          'inline-block w-3.5 h-3.5 rounded-pill shrink-0',
          DOT_CLASS[kind],
        )}
      />
      <span>{label}</span>
    </li>
  );
}
