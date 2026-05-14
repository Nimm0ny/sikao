import { cn } from '@sikao/shared-utils';
import { AnswerCell } from '@sikao/ui/ui';

// Phase 5.3c rewrite — 原 `.qcell` 圆角 + brand fill 迁到 element answer-grid
// editorial（方角 + ink/cream 对比）。复用 Phase 5.2 的 AnswerCell primitive。
//
// "当前模块"概念 element 无对应（它是单题级 current）——我们保留这个项目特性，
// 通过 SectionRow 外包一圈淡 ring 表达"这一组是当前在答的"。
//
// Dumb by contract: smart container 算好 answeredQuestionIds + activeSectionId 传入。
//
// Status 与 marked 是正交关系: status (current/done/pending) 描述视觉主态,
// marked (橙色三角) 是独立 flag overlay. 不能让 marked 把 current ring 或
// done check 吃掉 — 否则用户标记当前题就丢了"当前"提示, 标记已答题就显示
// 成"未答" (P0-2 修复).

export interface AnswerCardSection {
  readonly sectionId: string;
  readonly title: string;
  readonly questions: ReadonlyArray<{
    readonly questionId: string;
    readonly questionNo: number;
  }>;
}

export interface AnswerCardGridProps {
  readonly sections: readonly AnswerCardSection[];
  readonly answeredQuestionIds: ReadonlySet<string>;
  readonly flaggedQuestionIds?: ReadonlySet<string>;
  readonly activeQuestionIds?: ReadonlySet<string>;
  /** 当前在答的 section id —— 整组加淡 ring。 */
  readonly activeSectionId: string;
  readonly onSelectQuestion: (sectionId: string, questionId: string) => void;
}

export function AnswerCardGrid({
  sections,
  answeredQuestionIds,
  flaggedQuestionIds,
  activeQuestionIds,
  activeSectionId,
  onSelectQuestion,
}: AnswerCardGridProps) {
  return (
    <div data-testid="answer-card-grid" className="space-y-5">
      <Legend />
      {sections.map((section) => (
        <SectionRow
          key={section.sectionId}
          section={section}
          answeredQuestionIds={answeredQuestionIds}
          flaggedQuestionIds={flaggedQuestionIds}
          activeQuestionIds={activeQuestionIds}
          isActive={section.sectionId === activeSectionId}
          onSelectQuestion={onSelectQuestion}
        />
      ))}
    </div>
  );
}

interface SectionRowProps {
  readonly section: AnswerCardSection;
  readonly answeredQuestionIds: ReadonlySet<string>;
  readonly flaggedQuestionIds?: ReadonlySet<string>;
  readonly activeQuestionIds?: ReadonlySet<string>;
  readonly isActive: boolean;
  readonly onSelectQuestion: (sectionId: string, questionId: string) => void;
}

function cellStatus(
  qid: string,
  answered: ReadonlySet<string>,
  activeQuestionIds: ReadonlySet<string> | undefined,
): 'done' | 'current' | 'pending' {
  // 旧 fallback `(isActiveSection && index === 0)` 让 section 第 1 题永远
  // current — caller advance 到第 N 题后, cell-1 仍标 current, 挡住它的 done
  // 蓝色 (E2E lhr 反馈). PracticeSession 总传 activeQuestionIds, 不需要 fallback.
  if (activeQuestionIds?.has(qid)) return 'current';
  if (answered.has(qid)) return 'done';
  return 'pending';
}

function SectionRow({
  section,
  answeredQuestionIds,
  flaggedQuestionIds,
  activeQuestionIds,
  isActive,
  onSelectQuestion,
}: SectionRowProps) {
  if (section.questions.length === 0) return null;
  const answeredInSection = section.questions.filter((q) =>
    answeredQuestionIds.has(q.questionId),
  ).length;
  const firstQuestionNo = section.questions[0]?.questionNo;
  const lastQuestionNo = section.questions[section.questions.length - 1]?.questionNo;
  return (
    <div
      className={cn(
        'transition-[background-color,box-shadow] duration-fast',
        isActive && 'bg-paper-2/40',
      )}
    >
      <div className="text-xs text-ink-3 mb-2 flex items-center gap-5">
        <span className="text-sm font-bold text-ink">{section.title}</span>
        <span className="font-mono text-ink-4 tabular-nums">
          {firstQuestionNo}-{lastQuestionNo} · {answeredInSection}/{section.questions.length}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,28px)] gap-1 border-t border-line pt-2">
        {section.questions.map((q) => {
          const status = cellStatus(q.questionId, answeredQuestionIds, activeQuestionIds);
          const flagged = flaggedQuestionIds?.has(q.questionId) ?? false;
          return (
            <AnswerCell
              key={q.questionId}
              number={q.questionNo}
              status={status}
              flagged={flagged}
              className="w-7 h-7 aspect-auto text-xs"
              onClick={() => onSelectQuestion(section.sectionId, q.questionId)}
              data-testid={`answer-cell-${q.questionId}`}
              data-state={status}
              data-flagged={flagged ? 'true' : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="-mx-6 md:-mx-7 -mt-4 md:-mt-4 px-6 md:px-7 py-3 border-b border-line bg-surface-alt text-xs text-ink-3 flex items-center gap-7 flex-wrap">
      <span className="inline-flex items-center gap-2">
        <i data-pattern="dot" className="w-3.5 h-3.5 bg-surface-alt border border-line-3 inline-block rounded-full" />
        已答
      </span>
      <span className="inline-flex items-center gap-2">
        <i data-pattern="dot" className="w-3.5 h-3.5 bg-surface border border-ink inline-block rounded-full" />
        当前
      </span>
      <span className="inline-flex items-center gap-2">
        <i data-pattern="dot" className="relative w-3.5 h-3.5 bg-surface border border-line inline-block rounded-full">
          <span
            aria-hidden="true"
            className="absolute -top-px -right-px w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-warn"
          />
        </i>
        标记
      </span>
      <span className="inline-flex items-center gap-2">
        <i data-pattern="dot" className="w-3.5 h-3.5 bg-surface border border-line inline-block rounded-full" />
        未答
      </span>
    </div>
  );
}
