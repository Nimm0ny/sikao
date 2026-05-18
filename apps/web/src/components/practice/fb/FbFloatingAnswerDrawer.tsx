import { useState } from 'react';
import { AnswerCell, IconBtn, Tooltip } from '@sikao/ui/ui';
import { ChevronDownIcon } from '@sikao/ui/icons';
import { cn } from '@sikao/shared-utils';
import { PRACTICE_COPY } from '@/lib/ui-copy';
import type { SectionGroup } from './sectionGroups';

export interface FbFloatingAnswerDrawerProps {
  readonly sectionGroups: readonly SectionGroup[];
  readonly answers: Record<string, readonly string[]>;
  readonly flagged: ReadonlySet<string>;
  readonly currentVisibleQid: string | null;
  readonly answeredCount: number;
  readonly totalQuestions: number;
  readonly onSelectQuestion: (questionId: string) => void;
  readonly expanded?: boolean;
  readonly onExpandedChange?: (expanded: boolean) => void;
}

export function FbFloatingAnswerDrawer({
  sectionGroups,
  answers,
  flagged,
  currentVisibleQid,
  answeredCount,
  totalQuestions,
  onSelectQuestion,
  expanded,
  onExpandedChange,
}: FbFloatingAnswerDrawerProps) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const isExpanded = expanded ?? internalExpanded;
  const collapsed = !isExpanded;
  const setExpanded = (next: boolean): void => {
    if (onExpandedChange !== undefined) {
      onExpandedChange(next);
      return;
    }
    setInternalExpanded(next);
  };
  const toggleLabel = collapsed
    ? PRACTICE_COPY.fbAnswerDrawerExpand
    : PRACTICE_COPY.fbAnswerDrawerCollapse;

  return (
    <aside
      className={cn(
        'fixed left-1/2 bottom-6 z-30 -translate-x-1/2 overflow-hidden',
        'w-[min(720px,calc(100vw-32px))] rounded-card-lg border border-line bg-paper shadow-pop',
        'transition-[width,box-shadow] duration-base ease-motion',
        collapsed && 'w-[min(288px,calc(100vw-32px))] shadow-card',
      )}
      aria-label={PRACTICE_COPY.fbAnswerDrawerAriaLabel}
      data-collapsed={String(collapsed)}
      data-testid="fb-floating-answer-drawer"
    >
      <div
        className={cn(
          'flex min-h-14 items-center justify-between gap-4 px-5',
          !collapsed && 'border-b border-line',
        )}
      >
        <div className="flex items-baseline gap-2">
          <h2 className="font-serif text-h3 text-ink">
            {PRACTICE_COPY.fbAnswerDrawerTitle}
          </h2>
          <span className="font-mono text-small tabular-nums tracking-loose text-ink-4">
            {answeredCount}/{totalQuestions}
          </span>
        </div>
        <Tooltip label={toggleLabel} side="left">
          <IconBtn
            size="sm"
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            onClick={() => setExpanded(collapsed)}
            data-testid="fb-floating-answer-toggle"
          >
            <ChevronDownIcon
              size={16}
              className={cn('transition-transform', collapsed && 'rotate-180')}
            />
          </IconBtn>
        </Tooltip>
      </div>

      {!collapsed ? (
        <div
          className="overflow-x-auto px-5 py-4"
          data-testid="fb-floating-answer-body"
        >
          <nav
            className="flex flex-col gap-4"
            aria-label={PRACTICE_COPY.fbAnswerDrawerQuestionNav}
          >
            {sectionGroups.map((group) => (
              <section key={group.sectionId} data-testid={`fb-floating-section-${group.sectionId}`}>
                <div className="mb-3 flex items-center justify-between font-mono text-tiny tracking-eyebrow text-ink-3">
                  <span>{group.title}</span>
                  <span className="tabular-nums">{group.questions.length}</span>
                </div>
                <div className="grid w-max grid-cols-10 gap-4">
                  {group.questions.map((flat) => {
                    const qid = String(flat.question.questionId);
                    const isAnswered = answers[qid] !== undefined;
                    const isCurrent = currentVisibleQid === qid;
                    const isFlagged = flagged.has(qid);
                    const status = isCurrent ? 'current' : isAnswered ? 'done' : 'pending';
                    return (
                      <AnswerCell
                        key={qid}
                        number={flat.displayNo}
                        status={status}
                        flagged={isFlagged}
                        data-flagged={isFlagged ? 'true' : undefined}
                        onClick={() => onSelectQuestion(qid)}
                        data-testid={`fb-floating-cell-${qid}`}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        </div>
      ) : null}
    </aside>
  );
}
