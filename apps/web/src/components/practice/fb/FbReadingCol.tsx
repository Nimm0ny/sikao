import { logger } from '@sikao/shared-utils';
import { FbCard } from './FbCard';
import { FbMaterialAnalysisGroup } from './FbMaterialAnalysisGroup';
import type { QuestionRegistryEntry } from './useQuestionRegistry';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';
import type { SectionGroupItem, SectionItemsGroup } from './sectionGroups';

export interface FbReadingColProps {
  readonly sectionItemsGroups: readonly SectionItemsGroup[];
  readonly currentVisibleQid: string | null;
  readonly answers: Record<string, readonly string[]>;
  readonly flagged: ReadonlySet<string>;
  readonly onAnswer: (questionId: string, optionKeys: string[]) => void;
  readonly onToggleMark: (questionId: string, next: boolean) => void;
  readonly onOpenNote: (questionId: string) => void;
  readonly registerQuestion: (entry: QuestionRegistryEntry) => void;
  readonly unregisterQuestion: (questionId: string) => void;
  readonly onCurrentQuestionChange: (questionId: string) => void;
  readonly passagesCollapsed: boolean;
  readonly onTogglePassagesCollapsed: () => void;
  readonly onHighlightArm?: (questionId: string) => void;
  readonly armedQid?: string | null;
}

export function FbReadingCol({
  sectionItemsGroups,
  currentVisibleQid,
  answers,
  flagged,
  onAnswer,
  onToggleMark,
  onOpenNote,
  registerQuestion,
  unregisterQuestion,
  onCurrentQuestionChange,
  passagesCollapsed,
  onTogglePassagesCollapsed,
  onHighlightArm,
  armedQid,
}: FbReadingColProps) {
  return (
    <div className="flex flex-col gap-2" data-testid="fb-reading-col">
      {sectionItemsGroups.map((group) => (
        <section key={group.sectionId} data-testid={`fb-section-${group.sectionId}`}>
          {group.items.map((item, index) => (
            <SectionItemRenderer
              key={renderItemKey(group.sectionId, index, item)}
              sectionTitle={group.title}
              item={item}
              currentVisibleQid={currentVisibleQid}
              answers={answers}
              flagged={flagged}
              onAnswer={onAnswer}
              onToggleMark={onToggleMark}
              onOpenNote={onOpenNote}
              registerQuestion={registerQuestion}
              unregisterQuestion={unregisterQuestion}
              onCurrentQuestionChange={onCurrentQuestionChange}
              passagesCollapsed={passagesCollapsed}
              onTogglePassagesCollapsed={onTogglePassagesCollapsed}
              onHighlightArm={onHighlightArm}
              armedQid={armedQid ?? null}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function renderItemKey(sectionId: string, index: number, item: SectionGroupItem): string {
  if (item.kind === 'question') return `${sectionId}-q-${item.question.questionId}`;
  return `${sectionId}-mg-${item.materialGroup.materialGroupId}-${index}`;
}

interface SectionItemRendererProps {
  readonly sectionTitle: string;
  readonly item: SectionGroupItem;
  readonly currentVisibleQid: string | null;
  readonly answers: Record<string, readonly string[]>;
  readonly flagged: ReadonlySet<string>;
  readonly onAnswer: (questionId: string, optionKeys: string[]) => void;
  readonly onToggleMark: (questionId: string, next: boolean) => void;
  readonly onOpenNote: (questionId: string) => void;
  readonly registerQuestion: (entry: QuestionRegistryEntry) => void;
  readonly unregisterQuestion: (questionId: string) => void;
  readonly onCurrentQuestionChange: (questionId: string) => void;
  readonly passagesCollapsed: boolean;
  readonly onTogglePassagesCollapsed: () => void;
  readonly onHighlightArm?: (questionId: string) => void;
  readonly armedQid: string | null;
}

function SectionItemRenderer({
  sectionTitle,
  item,
  currentVisibleQid,
  answers,
  flagged,
  onAnswer,
  onToggleMark,
  onOpenNote,
  registerQuestion,
  unregisterQuestion,
  onCurrentQuestionChange,
  passagesCollapsed,
  onTogglePassagesCollapsed,
  onHighlightArm,
  armedQid,
}: SectionItemRendererProps) {
  if (item.kind === 'question') {
    return (
      <QuestionItemCard
        sectionTitle={sectionTitle}
        question={item.question}
        displayNo={item.displayNo}
        currentVisibleQid={currentVisibleQid}
        answers={answers}
        flagged={flagged}
        onAnswer={onAnswer}
        onToggleMark={onToggleMark}
        onOpenNote={onOpenNote}
        registerQuestion={registerQuestion}
        unregisterQuestion={unregisterQuestion}
        onCurrentQuestionChange={onCurrentQuestionChange}
        onHighlightArm={onHighlightArm}
        armedQid={armedQid}
      />
    );
  }

  return (
    <FbMaterialAnalysisGroup
      sectionTitle={sectionTitle}
      materialGroup={item.materialGroup}
      subQuestions={item.questions}
      currentVisibleQid={currentVisibleQid}
      answers={answers}
      flagged={flagged}
      onAnswer={onAnswer}
      onToggleMark={onToggleMark}
      onOpenNote={onOpenNote}
      onHighlightArm={onHighlightArm}
      armedQid={armedQid}
      registerQuestion={registerQuestion}
      unregisterQuestion={unregisterQuestion}
      onCurrentQuestionChange={onCurrentQuestionChange}
      materialCollapsed={passagesCollapsed}
      onToggleMaterialCollapsed={onTogglePassagesCollapsed}
    />
  );
}

interface QuestionItemCardProps {
  readonly sectionTitle: string;
  readonly question: QuestionDetailV2;
  readonly displayNo: number;
  readonly currentVisibleQid: string | null;
  readonly answers: Record<string, readonly string[]>;
  readonly flagged: ReadonlySet<string>;
  readonly onAnswer: (questionId: string, optionKeys: string[]) => void;
  readonly onToggleMark: (questionId: string, next: boolean) => void;
  readonly onOpenNote: (questionId: string) => void;
  readonly registerQuestion: (entry: QuestionRegistryEntry) => void;
  readonly unregisterQuestion: (questionId: string) => void;
  readonly onCurrentQuestionChange: (questionId: string) => void;
  readonly onHighlightArm?: (questionId: string) => void;
  readonly armedQid: string | null;
}

function QuestionItemCard({
  sectionTitle,
  question,
  displayNo,
  currentVisibleQid,
  answers,
  flagged,
  onAnswer,
  onToggleMark,
  onOpenNote,
  registerQuestion,
  unregisterQuestion,
  onCurrentQuestionChange,
  onHighlightArm,
  armedQid,
}: QuestionItemCardProps) {
  const qid = String(question.questionId);
  const isAnswered = answers[qid] !== undefined;

  return (
    <div
      ref={(node) => {
        if (node === null) {
          unregisterQuestion(qid);
          return;
        }
        registerQuestion({
          questionId: qid,
          node,
          scrollTo: () => {
            node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            onCurrentQuestionChange(qid);
          },
        });
      }}
      data-question-id={qid}
      data-testid={`fb-question-card-node-${qid}`}
      className="mb-2"
    >
      <FbCard
        question={question}
        questionDisplayNo={displayNo}
        sectionTitle={sectionTitle}
        isCurrent={qid === currentVisibleQid}
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
}
