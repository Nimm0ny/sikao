import type { PracticeSectionSummaryV2 } from '@sikao/api-client/types/api';

// 答题卡分段展示 (design/session/session-d.jsx 形态精简版, Result 上下文).
// Result 页只关心 3 态: 正确 / 错误 / 未答 (没有答题中的 marked / skip / current).
// 设计稿 5 段 + 进度条 + 题号 chip 复刻.
//
// 在 SidePanel 内渲染. cells/sections 都是 dumb props, onSelect 把交互
// 上抛给 Result.tsx (Result.tsx 持有 wrongRefs map, 负责 scrollIntoView).

export type CellState = 'correct' | 'wrong' | 'empty' | 'marked';

export interface AnswerCardCell {
  readonly questionId: string;
  readonly questionNo: number;
  readonly sectionId: string;
  readonly state: CellState;
}

export interface AnswerCardPanelProps {
  readonly cells: readonly AnswerCardCell[];
  readonly sections: readonly PracticeSectionSummaryV2[];
  readonly onSelect: (questionId: string, state: CellState) => void;
}

const STATE_STYLES: Record<CellState, string> = {
  correct: 'bg-ink text-white border-ink',
  wrong: 'bg-bad-bg text-err border-err',
  empty: 'bg-surface-alt text-ink-3 border-line',
  marked: 'bg-warn-bg text-warn border-warn',
};

const STATE_ARIA_SUFFIX: Record<CellState, string> = {
  correct: '正确',
  wrong: '错误，跳转到解析',
  empty: '未答',
  marked: '标记',
};

export function AnswerCardPanel({ cells, sections, onSelect }: AnswerCardPanelProps) {
  // 按 sectionId group cells (保 cells 原顺序 — 题号已经按 section 顺序排列).
  const cellsBySection = new Map<string, AnswerCardCell[]>();
  for (const cell of cells) {
    const arr = cellsBySection.get(cell.sectionId) ?? [];
    arr.push(cell);
    cellsBySection.set(cell.sectionId, arr);
  }

  const stats = {
    correct: cells.filter((c) => c.state === 'correct').length,
    wrong: cells.filter((c) => c.state === 'wrong').length,
    empty: cells.filter((c) => c.state === 'empty').length,
  };

  return (
    <div data-testid="answer-card-panel">
      {/* 图例 + 统计 */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 px-7 py-3 border-b border-line bg-surface-alt text-tiny">
        <Legend label="正确" stateClass={STATE_STYLES.correct} count={stats.correct} />
        <Legend label="错误" stateClass={STATE_STYLES.wrong} count={stats.wrong} />
        <Legend label="未答" stateClass={STATE_STYLES.empty} count={stats.empty} />
        <span className="flex-1" />
        <span className="text-ink-3 font-mono">共 {cells.length} 题</span>
      </div>

      {/* 分段 */}
      <div className="px-7 py-5 space-y-6">
        {sections.length === 0 ? (
          <CellGrid cells={cells} onSelect={onSelect} />
        ) : (
          sections.map((sec) => {
            const sectionCells = cellsBySection.get(sec.sectionId) ?? [];
            if (sectionCells.length === 0) return null;
            return (
              <SectionBlock
                key={sec.sectionId}
                title={sec.title}
                cells={sectionCells}
                onSelect={onSelect}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

interface LegendProps {
  readonly label: string;
  readonly stateClass: string;
  readonly count: number;
}

function Legend({ label, stateClass, count }: LegendProps) {
  return (
    <span className="inline-flex items-center gap-2 text-ink-3">
      <i aria-hidden="true" className={`inline-block w-3 h-3 rounded-1 border ${stateClass}`} />
      {label}
      <span className="font-mono text-ink-3">{count}</span>
    </span>
  );
}

interface SectionBlockProps {
  readonly title: string;
  readonly cells: readonly AnswerCardCell[];
  readonly onSelect: (questionId: string, state: CellState) => void;
}

function SectionBlock({ title, cells, onSelect }: SectionBlockProps) {
  const correct = cells.filter((c) => c.state === 'correct').length;
  const total = cells.length;
  const progressPct = total === 0 ? 0 : (correct / total) * 100;
  const firstNo = cells[0].questionNo;
  const lastNo = cells[cells.length - 1].questionNo;
  return (
    <section>
      <header className="flex items-center gap-3 mb-3 flex-wrap">
        <span aria-hidden="true" className="block w-1 h-3 rounded-pill bg-ink" />
        <span className="text-sm font-bold text-ink">{title}</span>
        <span className="text-tiny font-mono text-ink-3">
          {firstNo}–{lastNo} · 正确 {correct}/{total}
        </span>
        <span className="flex-1" />
        <span className="block w-24 h-1 bg-surface-alt rounded-pill overflow-hidden">
          <span
            aria-hidden="true"
            className="block h-full bg-ink"
            style={{ width: `${progressPct}%` }}
          />
        </span>
      </header>
      <CellGrid cells={cells} onSelect={onSelect} />
    </section>
  );
}

interface CellGridProps {
  readonly cells: readonly AnswerCardCell[];
  readonly onSelect: (questionId: string, state: CellState) => void;
}

function CellGrid({ cells, onSelect }: CellGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-2">
      {cells.map((cell) => (
        <button
          key={cell.questionId}
          type="button"
          onClick={() => onSelect(cell.questionId, cell.state)}
          aria-label={`第 ${cell.questionNo} 题 ${STATE_ARIA_SUFFIX[cell.state]}`}
          className={`
            h-10 rounded-1 border font-mono text-sm font-bold
            transition-colors hover:brightness-95
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            ${STATE_STYLES[cell.state]}
          `}
          data-testid={`answer-card-cell-${cell.questionId}`}
          data-state={cell.state}
        >
          <svg className="sr-only" width={1} height={1} aria-hidden="true">
            <path d="M0 0h1" />
          </svg>
          {cell.questionNo}
        </button>
      ))}
    </div>
  );
}
