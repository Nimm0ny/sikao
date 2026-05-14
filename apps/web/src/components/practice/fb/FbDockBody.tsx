import { AnswerCell } from '@sikao/ui/ui/AnswerCell';
import { FbDrawerGrid } from './FbDrawer';
import type { SectionGroup } from './sectionGroups';

// SIKAO Phase 3 (2026-05-09): fb 答题卡 dock body — 章节分组 + AnswerCell grid.
//
// 抽自 PracticeSession.tsx (单文件 ≤500 行硬约束).
//
// 设计 SSOT: docs/plan/sikao-xingce-phase3-core.md.
//
// Dumb component, 无副作用.

export interface FbDockBodyProps {
  readonly sectionGroups: readonly SectionGroup[];
  readonly answers: Record<string, readonly string[]>;
  readonly flagged: ReadonlySet<string>;
  readonly currentVisibleQid: string | null;
  readonly onSelectQuestion: (questionId: string) => void;
}

export function FbDockBody({
  sectionGroups,
  answers,
  flagged,
  currentVisibleQid,
  onSelectQuestion,
}: FbDockBodyProps) {
  return (
    <div className="flex flex-col gap-5">
      {sectionGroups.map((group) => (
        <div key={group.sectionId} data-testid={`fb-dock-section-${group.sectionId}`}>
          <div className="flex items-center justify-between mb-3 font-mono text-tiny tracking-eyebrow uppercase text-ink-3">
            <span>{group.title}</span>
            <span className="tabular-nums">{group.questions.length}</span>
          </div>
          <FbDrawerGrid cols={7}>
            {group.questions.map((flat) => {
              const qid = String(flat.question.questionId);
              const isAnswered = answers[qid] !== undefined;
              const isFlagged = flagged.has(qid);
              const isCurrent = qid === currentVisibleQid;
              const status: 'pending' | 'done' | 'current' = isCurrent
                ? 'current'
                : isAnswered
                  ? 'done'
                  : 'pending';
              return (
                <AnswerCell
                  key={qid}
                  number={flat.displayNo}
                  status={status}
                  flagged={isFlagged}
                  onClick={() => onSelectQuestion(qid)}
                  data-testid={`fb-dock-cell-${qid}`}
                />
              );
            })}
          </FbDrawerGrid>
        </div>
      ))}
    </div>
  );
}
