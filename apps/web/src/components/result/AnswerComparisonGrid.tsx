import { AnswerCell, Card } from '@sikao/ui/ui';
import type { AnswerCellStatus } from '@sikao/ui/ui';
import type { PracticeSectionSummaryV2 } from '@sikao/api-client/types/api';

// Phase 4.5 fenbi-merge — 改造为按 section 分段紧凑视图. 对齐 prototype 07
// .qgrid-section: 左侧 section 名 + 正确率 meta, 右侧 26x26 cell 流式排.
// 单一大网格 (旧版本) 信息密度低 + 看不出哪个模块错得最多.
//
// 复用 Phase 5.2 AnswerCell primitive: 三态 → AnswerCell status:
//   correct → 'correct', wrong → 'wrong', empty → 'pending'

export type AnswerCellState = 'correct' | 'wrong' | 'empty' | 'marked';

export interface AnswerComparisonCell {
  readonly questionId: string;
  readonly questionNo: number;
  readonly sectionId: string;
  readonly state: AnswerCellState;
}

export interface AnswerComparisonGridProps {
  readonly cells: readonly AnswerComparisonCell[];
  readonly sections: readonly PracticeSectionSummaryV2[];
}

const STATE_MAP: Record<AnswerCellState, AnswerCellStatus> = {
  correct: 'correct',
  wrong: 'wrong',
  empty: 'pending',
  marked: 'marked',
};

interface LegendChipProps {
  readonly label: string;
  readonly swatchClass: string;
}

function LegendChip({ label, swatchClass }: LegendChipProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <i aria-hidden="true" className={`inline-block w-3 h-3 rounded-1 ${swatchClass}`} />
      {label}
    </span>
  );
}

interface SectionRowProps {
  readonly section: PracticeSectionSummaryV2;
  readonly cells: readonly AnswerComparisonCell[];
}

function SectionRow({ section, cells }: SectionRowProps) {
  const wrongCount = cells.filter((c) => c.state === 'wrong').length;
  const isWeak = section.accuracyRate < 60;
  return (
    <div
      className="flex items-start gap-4 py-3 border-b border-dashed border-line last:border-b-0"
      data-testid={`compare-section-${section.sectionId}`}
    >
      <div className="shrink-0 w-24 pt-1">
        <div className="text-sm font-semibold text-ink">{section.title}</div>
        <div
          className={`text-xs font-mono tabular-nums mt-1 ${isWeak ? 'text-err' : 'text-ink-3'}`}
        >
          {section.correctCount}/{section.questionCount} · {Math.round(section.accuracyRate)}%
          {wrongCount > 0 ? ` · 错 ${wrongCount}` : ''}
        </div>
      </div>
      <div className="flex-1 flex flex-wrap gap-1">
        {cells.map((cell) => (
          <AnswerCell
            key={cell.questionId}
            number={cell.questionNo}
            status={STATE_MAP[cell.state]}
            className="w-7 h-7 aspect-auto text-xs rounded-1"
            disabled
            data-testid={`compare-cell-${cell.questionId}`}
            data-state={cell.state}
            data-visual-state={STATE_MAP[cell.state]}
            aria-label={
              cell.state === 'correct'
                ? `第 ${cell.questionNo} 题 正确`
                : cell.state === 'wrong'
                  ? `第 ${cell.questionNo} 题 错误`
                  : `第 ${cell.questionNo} 题 未答`
            }
          />
        ))}
      </div>
    </div>
  );
}

export function AnswerComparisonGrid({ cells, sections }: AnswerComparisonGridProps) {
  if (cells.length === 0) return null;
  const cellsBySection = new Map<string, AnswerComparisonCell[]>();
  for (const cell of cells) {
    const list = cellsBySection.get(cell.sectionId) ?? [];
    list.push(cell);
    cellsBySection.set(cell.sectionId, list);
  }
  // 按 sectionSummaries 顺序输出 (匹配 paper 顺序). section 内 cell 按 questionNo 升序.
  const knownSectionIds = new Set(sections.map((s) => s.sectionId));
  const orderedSections = sections
    .map((s) => {
      const list = cellsBySection.get(s.sectionId);
      if (list === undefined || list.length === 0) return null;
      const sorted = [...list].sort((a, b) => a.questionNo - b.questionNo);
      return { section: s, cells: sorted };
    })
    .filter((x): x is { section: PracticeSectionSummaryV2; cells: AnswerComparisonCell[] } => x !== null);
  // review-fix #7: cell.sectionId 不在 sections meta 里 → 不能 silent drop,
  // 收集到 orphan 行尾随显示, 避免用户看到题号断档不知道哪去了.
  const orphanCells = cells
    .filter((c) => !knownSectionIds.has(c.sectionId))
    .sort((a, b) => a.questionNo - b.questionNo);

  // 兜底: section meta 缺失时 (老 fixture) 退化为单段 "全部题"
  if (orderedSections.length === 0) {
    return (
      <Card padding="md" data-testid="answer-comparison-grid">
        <h3 className="font-bold text-2xl text-ink mb-4">答题矩阵</h3>
        <div className="flex flex-wrap gap-1">
          {cells.map((cell) => (
            <AnswerCell
              key={cell.questionId}
              number={cell.questionNo}
              status={STATE_MAP[cell.state]}
              className="w-7 h-7 aspect-auto text-xs rounded-1"
              disabled
              data-testid={`compare-cell-${cell.questionId}`}
              data-state={cell.state}
              data-visual-state={STATE_MAP[cell.state]}
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" data-testid="answer-comparison-grid">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h3 className="font-bold text-2xl text-ink">逐题状态</h3>
          <p className="text-xs text-ink-3 mt-1">按模块分段, 点击题号看解析 (即将上线)</p>
        </div>
        <div className="text-xs text-ink-3 flex items-center gap-3 flex-wrap">
          <LegendChip label="正确" swatchClass="bg-ok-bg border border-ok" />
          <LegendChip label="错误" swatchClass="bg-bad-bg border border-err" />
          <LegendChip label="未答" swatchClass="bg-surface border border-line" />
        </div>
      </div>
      <div>
        {orderedSections.map(({ section, cells: sectionCells }) => (
          <SectionRow key={section.sectionId} section={section} cells={sectionCells} />
        ))}
        {orphanCells.length > 0 ? (
          <div
            className="flex items-start gap-4 py-3 border-t border-dashed border-line"
            data-testid="compare-section-orphan"
          >
            <div className="shrink-0 w-24 pt-1">
              <div className="text-sm font-semibold text-warn">未归类</div>
              <div className="text-xs font-mono tabular-nums mt-1 text-ink-3">
                {orphanCells.length} 题
              </div>
            </div>
            <div className="flex-1 flex flex-wrap gap-1">
              {orphanCells.map((cell) => (
                <AnswerCell
                  key={cell.questionId}
                  number={cell.questionNo}
                  status={STATE_MAP[cell.state]}
                  className="w-7 h-7 aspect-auto text-xs rounded-1"
                  disabled
                  data-testid={`compare-cell-${cell.questionId}`}
                  data-state={cell.state}
                  data-visual-state={STATE_MAP[cell.state]}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
