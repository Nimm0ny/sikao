import { useCallback, useRef } from 'react';
import { IconBtn, Tooltip } from '@sikao/ui/ui';
import { NavBackIcon } from '@sikao/ui/icons';
import { logger } from '@sikao/shared-utils';
import { FbCard } from './FbCard';
import { FbChapterLabel } from './FbChapterLabel';
import { FbPassage, type FbPassageHandle } from './FbPassage';
import { splitPassageParagraphs } from './lib/splitPassageParagraphs';
import type { MaterialGroup, QuestionDetailV2 } from '@sikao/api-client/types/api';
import type { SectionGroupItem, SectionItemsGroup } from './sectionGroups';

export interface FbReadingColProps {
  readonly sectionItemsGroups: readonly SectionItemsGroup[];
  readonly currentVisibleQid: string | null;
  readonly answers: Record<string, readonly string[]>;
  readonly flagged: ReadonlySet<string>;
  readonly onAnswer: (questionId: string, optionKeys: string[]) => void;
  readonly onToggleMark: (questionId: string, next: boolean) => void;
  readonly onOpenNote: (questionId: string) => void;
  readonly onExit: () => void;
  readonly answeredCount: number;
  readonly totalQuestions: number;
  readonly registerQuestionCard: (
    questionId: string,
    node: HTMLElement | null,
  ) => void;
  /**
   * P6 (2026-05-11): 资料分析 passage 折叠态. 单 state 全 FbPassage 共享
   * (SPEC §10 "折叠资料分析材料" 是单一动作). PracticeSession 顶层维护.
   */
  readonly passagesCollapsed: boolean;
  readonly onTogglePassagesCollapsed: () => void;
  /**
   * P6: jumpToParagraph 折叠时强制展开 callback.
   */
  readonly onForceExpandPassages: () => void;
  /**
   * P5b/3: 透传到 FbCard 让 🖋 按钮 arm SelectionToolbar.
   * undefined → FbActions disabled stub fallback.
   */
  readonly onHighlightArm?: (questionId: string) => void;
  /**
   * P5b/3: 当前 armed qid (匹配 FbCard 时启 1.2s pulse).
   */
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
  onExit,
  answeredCount,
  totalQuestions,
  registerQuestionCard,
  passagesCollapsed,
  onTogglePassagesCollapsed,
  onForceExpandPassages,
  onHighlightArm,
  armedQid,
}: FbReadingColProps) {
  return (
    <div data-testid="fb-reading-col">
      <FbReadingHero
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        markedCount={flagged.size}
        onExit={onExit}
      />
      {sectionItemsGroups.map((group) => (
        <section key={group.sectionId} data-testid={`fb-section-${group.sectionId}`}>
          {group.items.map((item, idx) => (
            <SectionItemRenderer
              key={renderItemKey(group.sectionId, idx, item)}
              sectionTitle={group.title}
              item={item}
              currentVisibleQid={currentVisibleQid}
              answers={answers}
              flagged={flagged}
              onAnswer={onAnswer}
              onToggleMark={onToggleMark}
              onOpenNote={onOpenNote}
              registerQuestionCard={registerQuestionCard}
              passagesCollapsed={passagesCollapsed}
              onTogglePassagesCollapsed={onTogglePassagesCollapsed}
              onForceExpandPassages={onForceExpandPassages}
              onHighlightArm={onHighlightArm}
              armedQid={armedQid ?? null}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function renderItemKey(sectionId: string, idx: number, item: SectionGroupItem): string {
  if (item.kind === 'question') return `${sectionId}-q-${item.question.questionId}`;
  return `${sectionId}-mg-${item.materialGroup.materialGroupId}-${idx}`;
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
  readonly registerQuestionCard: (
    questionId: string,
    node: HTMLElement | null,
  ) => void;
  readonly passagesCollapsed: boolean;
  readonly onTogglePassagesCollapsed: () => void;
  readonly onForceExpandPassages: () => void;
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
  registerQuestionCard,
  passagesCollapsed,
  onTogglePassagesCollapsed,
  onForceExpandPassages,
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
        registerQuestionCard={registerQuestionCard}
        onHighlightArm={onHighlightArm}
        armedQid={armedQid}
      />
    );
  }
  return (
    <MaterialGroupItemRenderer
      sectionTitle={sectionTitle}
      materialGroup={item.materialGroup}
      subQuestions={item.questions}
      currentVisibleQid={currentVisibleQid}
      answers={answers}
      flagged={flagged}
      onAnswer={onAnswer}
      onToggleMark={onToggleMark}
      onOpenNote={onOpenNote}
      registerQuestionCard={registerQuestionCard}
      passagesCollapsed={passagesCollapsed}
      onTogglePassagesCollapsed={onTogglePassagesCollapsed}
      onForceExpandPassages={onForceExpandPassages}
      onHighlightArm={onHighlightArm}
      armedQid={armedQid}
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
  readonly registerQuestionCard: (
    questionId: string,
    node: HTMLElement | null,
  ) => void;
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
  registerQuestionCard,
  onHighlightArm,
  armedQid,
}: QuestionItemCardProps) {
  const qid = String(question.questionId);
  const isAnswered = answers[qid] !== undefined;
  return (
    <div
      ref={(node) => registerQuestionCard(qid, node)}
      data-question-id={qid}
      data-testid={`fb-question-card-node-${qid}`}
      className="mb-10"
    >
      <FbChapterLabel
        numLabel={`Q${displayNo}`}
        title={sectionTitle}
        completionLabel={isAnswered ? '已答' : '未答'}
      />
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

interface MaterialGroupItemRendererProps {
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
  readonly registerQuestionCard: (
    questionId: string,
    node: HTMLElement | null,
  ) => void;
  readonly passagesCollapsed: boolean;
  readonly onTogglePassagesCollapsed: () => void;
  readonly onForceExpandPassages: () => void;
  readonly onHighlightArm?: (questionId: string) => void;
  readonly armedQid: string | null;
}

function MaterialGroupItemRenderer({
  sectionTitle,
  materialGroup,
  subQuestions,
  currentVisibleQid,
  answers,
  flagged,
  onAnswer,
  onToggleMark,
  onOpenNote,
  registerQuestionCard,
  passagesCollapsed,
  onTogglePassagesCollapsed,
  onForceExpandPassages,
  onHighlightArm,
  armedQid,
}: MaterialGroupItemRendererProps) {
  const passageRef = useRef<FbPassageHandle>(null);
  const paragraphs = splitPassageParagraphs(materialGroup.content ?? '');
  const handleJump = useCallback((paragraphId: string) => {
    passageRef.current?.jumpToParagraph(paragraphId);
  }, []);
  return (
    <div
      className="mb-10"
      data-testid={`fb-material-group-${materialGroup.materialGroupId}`}
    >
      <FbPassage
        ref={passageRef}
        materialGroup={materialGroup}
        sectionTitle={sectionTitle}
        collapsed={passagesCollapsed}
        onToggleCollapsed={onTogglePassagesCollapsed}
        onForceExpand={onForceExpandPassages}
      />
      {subQuestions.map(({ question, displayNo }) => {
        const qid = String(question.questionId);
        const isAnswered = answers[qid] !== undefined;
        return (
          <div
            key={qid}
            ref={(node) => registerQuestionCard(qid, node)}
            data-question-id={qid}
            data-testid={`fb-question-card-node-${qid}`}
            className="mb-8"
          >
            <FbChapterLabel
              numLabel={`Q${displayNo}`}
              title={sectionTitle}
              completionLabel={isAnswered ? '已答' : '未答'}
            />
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
            {/* P4/3 anchor strip: 子题之后追加 ⤴ 回跳材料段落.
                TODO(P4-followup): 选项级 anchor (option→paragraph mapping)
                等 BE schema 加 optionToParagraph 字段后做 — 当前展示所有段落
                button, 用户自选. */}
            {paragraphs.length > 0 ? (
              <nav
                className="flex flex-wrap gap-3 mt-3"
                aria-label="回跳材料段落"
                data-testid={`fb-anchor-strip-${qid}`}
              >
                {paragraphs.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleJump(p.id)}
                    className="font-mono text-tiny tracking-eyebrow text-accent hover:underline"
                    data-testid={`fb-anchor-jump-${qid}-${p.id}`}
                  >
                    {`⤴ 段${idx + 1}`}
                  </button>
                ))}
              </nav>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

interface FbReadingHeroProps {
  readonly answeredCount: number;
  readonly totalQuestions: number;
  readonly markedCount: number;
  readonly onExit: () => void;
}

function FbReadingHero({
  answeredCount,
  totalQuestions,
  markedCount,
  onExit,
}: FbReadingHeroProps) {
  // Wave 9 Phase 2a (2026-05-12): mobile mb-8 / pb-4 紧凑, tablet+ mb-12 / pb-6 维持现状.
  return (
    <header className="mb-8 md:mb-12 pb-4 md:pb-6 border-b border-line">
      <p className="font-mono text-tiny tracking-eyebrow uppercase text-ink-3 mb-2">
        行测真题练习
      </p>
      <h1 className="font-serif text-h-card md:text-h-section font-medium text-ink leading-tight">
        行政职业能力测验
      </h1>
      <dl className="mt-4 md:mt-6 grid grid-cols-3 gap-4 md:gap-6 py-3 md:py-4 border-y border-line">
        <FbReadingMeta label="总题量" value={String(totalQuestions)} />
        <FbReadingMeta label="已答" value={String(answeredCount)} />
        <FbReadingMeta label="已标记" value={String(markedCount)} />
      </dl>
      <div className="mt-4">
        <Tooltip label="返回题库" side="right">
          <IconBtn
            size="sm"
            aria-label="返回题库"
            onClick={onExit}
            data-testid="fb-reading-exit"
          >
            <NavBackIcon size={16} />
          </IconBtn>
        </Tooltip>
      </div>
    </header>
  );
}

interface FbReadingMetaProps {
  readonly label: string;
  readonly value: string;
}

function FbReadingMeta({ label, value }: FbReadingMetaProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-tiny tracking-wider uppercase text-ink-3">
        {label}
      </dt>
      <dd className="font-serif text-h-card text-ink tabular-nums leading-none">
        {value}
      </dd>
    </div>
  );
}
