import { useCallback, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { ChevronDownIcon } from '@sikao/ui/icons';
import { Badge, IconBtn, Tooltip } from '@sikao/ui/ui';
import { cn, logger } from '@sikao/shared-utils';
import { PRACTICE_COPY } from '@/lib/ui-copy';
import { FbCard } from './FbCard';
import type { QuestionRegistryEntry } from './useQuestionRegistry';
import type { MaterialGroup, QuestionDetailV2 } from '@sikao/api-client/types/api';

export interface FbMaterialAnalysisGroupProps {
  readonly sectionTitle: string;
  readonly materialGroup: MaterialGroup;
  readonly subQuestions: ReadonlyArray<{
    readonly question: QuestionDetailV2;
    readonly displayNo: number;
  }>;
  readonly currentVisibleQid: string | null;
  readonly answers: Record<string, readonly string[]>;
  readonly flagged: ReadonlySet<string>;
  readonly onAnswer: (questionId: string, optionKeys: string[]) => void;
  readonly onToggleMark: (questionId: string, next: boolean) => void;
  readonly onOpenNote: (questionId: string) => void;
  readonly onHighlightArm?: (questionId: string) => void;
  readonly armedQid: string | null;
  readonly registerQuestion: (entry: QuestionRegistryEntry) => void;
  readonly unregisterQuestion: (questionId: string) => void;
  readonly onCurrentQuestionChange: (questionId: string) => void;
  readonly materialCollapsed: boolean;
  readonly onToggleMaterialCollapsed: () => void;
}

export function FbMaterialAnalysisGroup({
  sectionTitle,
  materialGroup,
  subQuestions,
  currentVisibleQid,
  answers,
  flagged,
  onAnswer,
  onToggleMark,
  onOpenNote,
  onHighlightArm,
  armedQid,
  registerQuestion,
  unregisterQuestion,
  onCurrentQuestionChange,
  materialCollapsed,
  onToggleMaterialCollapsed,
}: FbMaterialAnalysisGroupProps) {
  const [activeQid, setActiveQid] = useState(() => firstQuestionId(subQuestions));
  const questionNodes = useRef(new Map<string, HTMLElement>());
  const scrollPaneRef = useRef<HTMLDivElement | null>(null);
  const sanitized = useMemo(
    () => ({ __html: DOMPurify.sanitize(materialGroup.content ?? '') }),
    [materialGroup.content],
  );
  const displayActiveQid = currentVisibleQid ?? activeQid;
  const materialBodyId = `fb-material-body-${materialGroup.materialGroupId}`;
  const collapseLabel = materialCollapsed
    ? PRACTICE_COPY.fbMaterialExpand
    : PRACTICE_COPY.fbMaterialCollapse;

  const setActiveQuestion = useCallback(
    (questionId: string) => {
      setActiveQid(questionId);
      onCurrentQuestionChange(questionId);
    },
    [onCurrentQuestionChange],
  );

  const scrollToQuestion = useCallback(
    (questionId: string) => {
      const node = questionNodes.current.get(questionId);
      if (node === undefined) {
        throw new Error(`Material question ${questionId} is not mounted.`);
      }
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveQuestion(questionId);
    },
    [setActiveQuestion],
  );

  const registerNode = useCallback(
    (questionId: string, node: HTMLElement | null) => {
      if (node === null) {
        questionNodes.current.delete(questionId);
        unregisterQuestion(questionId);
        return;
      }
      questionNodes.current.set(questionId, node);
      registerQuestion({
        questionId,
        node,
        scrollTo: () => scrollToQuestion(questionId),
      });
    },
    [registerQuestion, scrollToQuestion, unregisterQuestion],
  );

  const handleScroll = useCallback(() => {
    const pane = scrollPaneRef.current;
    if (pane === null) return;
    const centerLine = pane.scrollTop + pane.clientHeight * 0.34;
    let nextQid = firstQuestionId(subQuestions);
    for (const item of subQuestions) {
      const qid = String(item.question.questionId);
      const node = questionNodes.current.get(qid);
      if (node === undefined) continue;
      if (node.offsetTop <= centerLine) nextQid = qid;
    }
    setActiveQuestion(nextQid);
  }, [setActiveQuestion, subQuestions]);

  return (
    <section
      className="mb-8 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]"
      data-testid={`fb-material-analysis-${materialGroup.materialGroupId}`}
    >
      <aside
        className={cn(
          'grid max-h-[calc(100vh-176px)] overflow-hidden rounded-card-lg border border-line bg-paper shadow-card',
          materialCollapsed ? 'min-h-14 grid-rows-[auto]' : 'min-h-[620px] grid-rows-[auto_1fr]',
        )}
        data-collapsed={String(materialCollapsed)}
      >
        <div className="flex min-h-12 items-center justify-between gap-4 border-b border-line px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Badge tone="brand" variant="chip">
              {PRACTICE_COPY.fbMaterialLabel}
            </Badge>
            <span className="truncate font-serif text-body font-semibold text-ink-2">
              {materialGroup.title}
            </span>
          </div>
          <Tooltip label={collapseLabel} side="left">
            <IconBtn
              size="sm"
              aria-label={collapseLabel}
              aria-expanded={!materialCollapsed}
              aria-controls={materialBodyId}
              onClick={onToggleMaterialCollapsed}
              data-testid={`fb-material-collapse-${materialGroup.materialGroupId}`}
            >
              <ChevronDownIcon
                size={16}
                className={cn('transition-transform', materialCollapsed && '-rotate-90')}
              />
            </IconBtn>
          </Tooltip>
        </div>
        {!materialCollapsed ? (
          <>
            <article
              id={materialBodyId}
              className="overflow-y-auto px-6 py-5 font-serif text-body font-semibold leading-relaxed text-ink"
              data-testid={`fb-material-body-${materialGroup.materialGroupId}`}
              dangerouslySetInnerHTML={sanitized}
            />
            <MaterialAssets materialGroup={materialGroup} />
          </>
        ) : null}
      </aside>

      <section
        className="grid max-h-[calc(100vh-176px)] min-h-[620px] grid-rows-[auto_1fr] overflow-hidden rounded-card-lg border border-line bg-paper shadow-card"
        aria-label={sectionTitle}
      >
        <div className="relative border-b border-line bg-paper">
          <div
            role="tablist"
            aria-label={PRACTICE_COPY.fbMaterialTabList}
            className="flex h-16 items-center gap-6 overflow-x-auto px-5"
            data-testid={`fb-material-tabs-${materialGroup.materialGroupId}`}
          >
            {subQuestions.map(({ question, displayNo }) => {
              const qid = String(question.questionId);
              const active = displayActiveQid === qid;
              return (
                // svg-only-allow: material question tab is content navigation, not a tool icon
                <button
                  key={qid}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => scrollToQuestion(qid)}
                  className={cn(
                    'relative h-16 shrink-0 border-0 bg-transparent px-0',
                    'font-mono text-small tabular-nums tracking-loose text-ink-3',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    active && 'font-semibold text-ink',
                  )}
                  data-testid={`fb-material-tab-${qid}`}
                >
                  {displayNo}题
                  {active ? (
                    <span className="absolute bottom-3 left-1/2 h-1 w-5 -translate-x-1/2 rounded-pill bg-accent" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div
          ref={scrollPaneRef}
          className="overflow-y-auto px-4 py-5"
          onScroll={handleScroll}
          data-testid={`fb-material-question-scroll-${materialGroup.materialGroupId}`}
        >
          <div className="flex flex-col gap-5">
            {subQuestions.map(({ question, displayNo }) => {
              const qid = String(question.questionId);
              const isAnswered = answers[qid] !== undefined;
              return (
                <div
                  key={qid}
                  ref={(node) => registerNode(qid, node)}
                  data-question-id={qid}
                  data-testid={`fb-material-question-node-${qid}`}
                >
                  <FbCard
                    question={question}
                    questionDisplayNo={displayNo}
                    sectionTitle={sectionTitle}
                    isCurrent={displayActiveQid === qid}
                    isAnswered={isAnswered}
                    selectedAnswers={answers[qid] ?? []}
                    isFavorited={false}
                    isMarked={flagged.has(qid)}
                    hasNote={false}
                    armed={armedQid === qid}
                    onAnswer={onAnswer}
                    onToggleFavorite={() => {
                      logger.info('practice.fb.favorite.noop', { questionId: qid });
                    }}
                    onToggleMark={onToggleMark}
                    onOpenNote={onOpenNote}
                    onHighlightArm={onHighlightArm}
                  />
                </div>
              );
            })}
            <div className="flex min-h-14 items-center justify-center text-small text-ink-4">
              {PRACTICE_COPY.fbMaterialDone}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

function firstQuestionId(
  subQuestions: ReadonlyArray<{ readonly question: QuestionDetailV2 }>,
): string {
  const first = subQuestions[0];
  if (first === undefined) {
    throw new Error('Material analysis group requires at least one question.');
  }
  return String(first.question.questionId);
}

function MaterialAssets({ materialGroup }: { readonly materialGroup: MaterialGroup }) {
  const imageAssets = (materialGroup.assets ?? []).filter((a) => a.mimeType.startsWith('image/'));
  if (imageAssets.length === 0) return null;
  return (
    <div className="border-t border-line px-6 py-4" data-testid="fb-material-assets">
      {imageAssets.map((asset) => (
        <img
          key={asset.id}
          src={asset.url}
          alt={asset.assetRole || PRACTICE_COPY.fbMaterialImageAlt}
          loading="lazy"
          className="h-auto max-w-full rounded-card border border-line bg-paper"
        />
      ))}
    </div>
  );
}
