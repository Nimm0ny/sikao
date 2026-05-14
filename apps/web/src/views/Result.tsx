import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApplyExamTheme } from '@/styles/useThemeStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '@sikao/api-client/request';
import { useDevice } from '@sikao/shared-utils/hooks/useDevice';
import { ResultMobile } from './result/ResultMobile';
import { Button, EmptyState, SidePanel, Tooltip } from '@sikao/ui/ui';
import { AlertCircleIcon, HelpIcon, RefreshIcon } from '@sikao/ui/icons';
import { ERROR_COPY, LLM_QA_COPY } from '@/lib/ui-copy';
import { ChatPanel } from '@/components/llm/ChatPanel';
import { AskDrawer } from '@/components/ask/AskDrawer';
import { useScrollSpyTab } from '@sikao/shared-utils/hooks/useScrollSpyTab';
import {
  AiSuggestionCard,
  AnswerCardPanel,
  AnswerComparisonGrid,
  KnowledgePointFocus,
  ResultActions,
  ResultAside,
  ResultHero,
  ResultPageSkeleton,
  ResultTabNav,
  ScoreModuleCard,
  SlowestQuestions,
  SubjectCatTable,
  TimingByModule,
  TimingTimeline,
  WrongReviewSection,
} from '@/components/result';
import type { ResultTabItem, CellState } from '@/components/result';
import {
  buildAnswerCardCells,
  buildClassificationSets,
  buildComparisonCells,
  buildSectionLabels,
  buildTimings,
  buildWrongItems,
  calcDurationSeconds,
  pickTitle,
} from '@/components/result/_resultHelpers';
import { pickSlowestQuestions } from '@sikao/shared-utils';
import type { PracticeSessionResultV2 } from '@sikao/api-client/types/api';

// Phase 3.3 rewrite — drops the legacy in-view Sidebar/Trophy hero
// (AppShell + ResultHero replace it) and consumes the richer result
// schema (session + sectionSummaries + answers + questions). All sub-cards
// are dumb and live under components/result/*; this view stays a thin
// smart shell that fetches once, derives view-models with pure helpers
// (extracted to components/result/_resultHelpers.ts in SIKAO Wave 2 Phase 2
// to keep this file ≤ 500 行), and dispatches navigation.
//
// SIKAO Wave 2 Phase 2 (2026-05-11) — hifi 05 paper-tint res-shell layout
// 升级: ResultHero (大数字 + headline + meta + 击败% bell) 替代旧 ScoreHero;
// 右侧 320 col ResultAside (答题卡缩略 + 用时分布 + 看错题 / 导出 PDF CTA);
// 主体加 SubjectCatTable (5 考点 cat-table). 之后 ResultTabNav + 4 anchor
// section 保持 scroll-spy IA 不变.
//
// Phase 6.1 — answer card SidePanel: 点击题号 → 关闭 panel → 平滑滚动到
// 该题的 WrongReviewCard (只有错题在 Result 页有 anchor; 正确 / 未答只
// 关闭 panel 不滚动). 设计参 design/session/session-d.jsx.

interface UseResultActionsArgs {
  readonly sessionData: PracticeSessionResultV2 | undefined;
  readonly navigate: (to: string) => void;
}

function useResultActions(args: UseResultActionsArgs) {
  const { sessionData, navigate } = args;
  const onBackHome = useCallback(() => navigate('/app'), [navigate]);
  const paperCode = sessionData?.session?.paperCode ?? null;
  const onRetry = useCallback(() => {
    if (paperCode === null) return;
    navigate(`/practice/${paperCode}/start`);
  }, [paperCode, navigate]);
  // P0-1 看本套错题: 跳错题本带 paperCode filter. paperCode 缺时 disable
  // (通常 retry session / cross-paper 才会缺, 行测主流程都有 paperCode).
  const onViewWrong = useCallback(() => {
    if (paperCode === null) return;
    navigate(`/wrong-book?paperCode=${encodeURIComponent(paperCode)}`);
  }, [paperCode, navigate]);
  return {
    onBackHome,
    onRetry,
    onViewWrong,
    retryDisabled: paperCode === null,
    viewWrongDisabled: paperCode === null,
  } as const;
}

// 关闭 panel 后等动画收完再 scroll, 否则 panel 还在视口里挡着.
// SidePanel exit transition 是 spring (~280ms 落定), 320ms 给安全 buffer.
const PANEL_CLOSE_DELAY_MS = 320;
const HIGHLIGHT_PULSE_MS = 1400;

function useAnswerCardPanel() {
  const [open, setOpen] = useState(false);
  const wrongRefs = useRef(new Map<string, HTMLElement>());

  const registerWrongRef = useCallback((qid: string, el: HTMLElement | null): void => {
    if (el === null) wrongRefs.current.delete(qid);
    else wrongRefs.current.set(qid, el);
  }, []);

  const onSelect = useCallback((questionId: string, state: CellState): void => {
    setOpen(false);
    // 只有 wrong 在 Result 页有锚点 (WrongReviewCard); correct/empty 无 card
    if (state !== 'wrong') return;
    setTimeout(() => {
      const el = wrongRefs.current.get(questionId);
      if (el === undefined) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // 短暂 pulse 高亮被定位的卡, 给视觉反馈 "就是这道"
      el.classList.add('animate-pulse');
      setTimeout(() => el.classList.remove('animate-pulse'), HIGHLIGHT_PULSE_MS);
    }, PANEL_CLOSE_DELAY_MS);
  }, []);

  return {
    open,
    openPanel: useCallback(() => setOpen(true), []),
    closePanel: useCallback(() => setOpen(false), []),
    registerWrongRef,
    onSelect,
  };
}

/**
 * Result — device-aware dispatch shell (PR9, 2026-05-13).
 *
 * mobile (<1024)  → ResultMobile (M4 layout: hero 大数字 + mstat + 速看)
 * tablet/desktop  → ResultDesktop (现有 ResultTabNav + 4 section)
 *
 * Handoff §5.1: 不新建 views/m/*.tsx; 共享 react-query queryKey cache.
 */
export default function Result() {
  const device = useDevice();
  if (device === 'mobile') return <ResultMobile />;
  return <ResultDesktop />;
}

function ResultDesktop() {
  // Phase 3.6 fenbi-merge — D3: 报告页属考场态, 应用 examTheme.
  useApplyExamTheme();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const query = useQuery<PracticeSessionResultV2>({
    queryKey: ['practiceResult', sessionId],
    queryFn: () => api.get<PracticeSessionResultV2>(`/practice/sessions/${sessionId ?? ''}/result`),
    enabled: sessionId !== undefined,
  });
  const actions = useResultActions({ sessionData: query.data, navigate });
  // Phase 4.1 — skeleton replaces the old spinner (keeps the page frame intact).
  if (query.isLoading) return <ResultPageSkeleton />;
  if (query.isError || query.data === undefined) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={ERROR_COPY.result.title}
          description={ERROR_COPY.result.description}
          action={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => { void query.refetch(); }}
                data-testid="result-retry"
              >
                <RefreshIcon className="w-4 h-4 mr-2" />
                重试
              </Button>
              <Button
                variant="quiet"
                onClick={actions.onBackHome}
                data-testid="result-error-home"
              >
                返回首页
              </Button>
            </div>
          }
        />
      </div>
    );
  }
  return (
    <ResultBody
      result={query.data}
      onBackHome={actions.onBackHome}
      onRetry={actions.onRetry}
      onViewWrong={actions.onViewWrong}
      retryDisabled={actions.retryDisabled}
      viewWrongDisabled={actions.viewWrongDisabled}
    />
  );
}

interface ResultBodyProps {
  readonly result: PracticeSessionResultV2;
  readonly onBackHome: () => void;
  readonly onRetry: () => void;
  readonly onViewWrong: () => void;
  readonly retryDisabled: boolean;
  readonly viewWrongDisabled: boolean;
}

// P0-6 audit: Result 5+屏纵向, sticky tab nav 4 锚点对应 4 段 section.
// section id 跟 nav onclick / scroll-spy 共享 SSOT, 改 id 必须同步改 4 段的
// id={...} props.
const RESULT_TABS: ReadonlyArray<ResultTabItem> = [
  { id: 'overview', label: '总览' },
  { id: 'questions', label: '题目' },
  { id: 'timing', label: '用时' },
  { id: 'actions', label: '操作' },
];
const RESULT_TAB_IDS: ReadonlyArray<string> = RESULT_TABS.map((t) => t.id);

function ResultBody({
  result,
  onBackHome,
  onRetry,
  onViewWrong,
  retryDisabled,
  viewWrongDisabled,
}: ResultBodyProps) {
  const navigate = useNavigate();
  const cells = buildComparisonCells(result);
  const cardCells = buildAnswerCardCells(result);
  const wrongItems = buildWrongItems(result);
  const sectionSummaries = result.sectionSummaries ?? [];
  const timings = buildTimings(result);
  const timingsByQuestionNo = [...timings].sort((a, b) => a.questionNo - b.questionNo);
  const slowest = pickSlowestQuestions(timings, 5);
  const sectionLabels = buildSectionLabels(result);
  const { wrongIds, unansweredIds } = buildClassificationSets(result);
  const panel = useAnswerCardPanel();
  const tabIds = useMemo(() => RESULT_TAB_IDS, []);
  const activeTabId = useScrollSpyTab(tabIds);
  // PR10 AskDrawer state — 点错题卡 ask 按钮打开. 单一活动 question.
  const [askQid, setAskQid] = useState<string | null>(null);
  const onAsk = useCallback((qid: string): void => setAskQid(qid), []);
  const closeAsk = useCallback((): void => setAskQid(null), []);
  const onSlowestSelect = useCallback(
    (qid: string) => {
      const state: CellState = wrongIds.has(qid) ? 'wrong' : unansweredIds.has(qid) ? 'empty' : 'correct';
      panel.onSelect(qid, state);
    },
    [wrongIds, unansweredIds, panel],
  );
  const onKnowledgePointSelect = useCallback(
    (subject: string | null, subtype: string): void => {
      const params = new URLSearchParams();
      if (subject) params.set('subject', subject);
      if (subtype) params.set('subtype', subtype);
      const qs = params.toString();
      navigate(qs ? `/wrong-book?${qs}` : '/wrong-book');
    },
    [navigate],
  );
  const durationSeconds = result.session !== undefined
    ? calcDurationSeconds(result.session.startedAt, result.session.completedAt)
    : undefined;

  // SIKAO Wave 2 Phase 2 — hifi 05 paper-tint res-shell 双段 layout 仅
  // 用于 hero + cat-table + aside; 之后 ResultTabNav + 4 个 anchor section
  // 仍走单列 stack 保 scroll-spy IA 不变. answerStateById 一处构造一处复用,
  // 同时给 cat-table 跟 aside 用.
  const totalQuestionCount =
    result.correctCount + result.incorrectCount + result.unansweredCount;
  const answerStateById = new Map<string, 'correct' | 'wrong' | 'empty'>();
  for (const cell of cardCells) {
    if (cell.state === 'marked') continue;
    answerStateById.set(cell.questionId, cell.state);
  }

  return (
    <div
      className="max-w-[1200px] mx-auto px-4 md:px-14 pt-6 md:pt-12 pb-12 space-y-10"
      data-testid="result-view"
    >
      {/* TODO(2026-05-06 xiaodeng): prevScoreDelta 接 GET /me/papers/{id}/prev-score
          (Phase 5 follow-up); defeatPercentile 接 GET /papers/{id}/distribution
          (Phase 4.2 follow-up). 数据未到位前传 null → ResultHero 不渲染对应 chip. */}

      {/* hifi 05 res-shell: left main (hero + cat-table) + right 320 col aside.
          gap 48px (md+); ≤md 单列堆叠. lg 处启用双段. */}
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-12">
          <ResultHero
            paperName={pickTitle(result)}
            score={result.score}
            correctCount={result.correctCount}
            questionCount={totalQuestionCount}
            submittedAt={result.session?.completedAt ?? result.session?.startedAt}
            durationSeconds={durationSeconds}
            prevScoreDelta={null}
            defeatPercentile={null}
            exportPdfDisabledHint="即将上线"
            onContinueReview={panel.openPanel}
          />
          {(result.subjectSummaries ?? []).length > 0 ? (
            <SubjectCatTable subjects={result.subjectSummaries ?? []} />
          ) : null}
        </div>
        <ResultAside
          correctCount={result.correctCount}
          incorrectCount={result.incorrectCount}
          unansweredCount={result.unansweredCount}
          questionCount={totalQuestionCount}
          subjects={result.subjectSummaries ?? []}
          questions={result.questions ?? []}
          timings={timings}
          answerStateById={answerStateById}
          onOpenAnswerCard={panel.openPanel}
          onViewWrong={onViewWrong}
          exportPdfDisabledHint="即将上线"
          viewWrongDisabled={viewWrongDisabled}
        />
      </div>

      <ResultTabNav tabs={RESULT_TABS} activeId={activeTabId} />

      {/* §overview — 解析建议 + 分数 / 模块 + 答题对照矩阵 */}
      <section
        id="overview"
        data-testid="result-section-overview"
        aria-labelledby="result-section-overview-label"
        className="space-y-6 scroll-mt-24"
      >
        <h2 id="result-section-overview-label" className="sr-only">总览</h2>
        <div data-testid="result-ai-region">
          <AiSuggestionCard
            subtypes={result.subtypeSummaries ?? []}
            onSelect={onKnowledgePointSelect}
          />
        </div>

        <div
          className="grid gap-6 md:grid-cols-[minmax(0,744px)_minmax(320px,432px)]"
          data-testid="result-matrix-review-grid"
        >
          <div data-testid="result-score-region">
            <ScoreModuleCard
              score={result.score}
              correctCount={result.correctCount}
              incorrectCount={result.incorrectCount}
              unansweredCount={result.unansweredCount}
              sections={sectionSummaries}
              subjects={result.subjectSummaries ?? []}
            />
          </div>

          <div data-testid="result-matrix-region">
            <AnswerComparisonGrid cells={cells} sections={sectionSummaries} />
          </div>
        </div>
      </section>

      {/* §questions — 错题精讲 + 知识点聚焦 */}
      <section
        id="questions"
        data-testid="result-section-questions"
        aria-labelledby="result-section-questions-label"
        className="space-y-6 scroll-mt-24"
      >
        <h2 id="result-section-questions-label" className="sr-only">题目</h2>
        <div data-testid="result-wrong-region">
          {result.questions !== undefined && result.answers !== undefined ? (
            <WrongReviewSection
              items={wrongItems}
              registerRef={panel.registerWrongRef}
              onAsk={onAsk}
            />
          ) : null}
        </div>
        <KnowledgePointFocus
          subtypes={result.subtypeSummaries ?? []}
          onSelect={onKnowledgePointSelect}
        />
      </section>

      {/* §timing — 模块用时 + 时间线 + 最慢题 */}
      <section
        id="timing"
        data-testid="result-section-timing"
        aria-labelledby="result-section-timing-label"
        className="space-y-5 scroll-mt-24"
      >
        <h2 id="result-section-timing-label" className="sr-only">用时</h2>
        <TimingByModule
          timings={timings}
          sections={sectionSummaries}
          questions={result.questions ?? []}
        />
        <TimingTimeline
          timings={timingsByQuestionNo}
          wrongIds={wrongIds}
          unansweredIds={unansweredIds}
          sectionLabels={sectionLabels}
        />
        <SlowestQuestions slowest={slowest} onSelect={onSlowestSelect} />
      </section>

      {/* §actions — 返回 / 重做 / 看本套错题 */}
      <section
        id="actions"
        data-testid="result-section-actions"
        aria-labelledby="result-section-actions-label"
        className="scroll-mt-24"
      >
        <h2 id="result-section-actions-label" className="sr-only">操作</h2>
        <ResultActions
          onBackHome={onBackHome}
          onRetry={onRetry}
          onViewWrong={onViewWrong}
          retryDisabled={retryDisabled}
          viewWrongDisabled={viewWrongDisabled}
        />
      </section>

      <SidePanel
        open={panel.open}
        onClose={panel.closePanel}
        title="答题卡"
        ariaLabel="答题卡 · 点击题号跳转"
      >
        <AnswerCardPanel
          cells={cardCells}
          sections={sectionSummaries}
          onSelect={panel.onSelect}
        />
      </SidePanel>
      <ResultAskAi />
      {askQid !== null ? (
        <AskDrawer open={true} onClose={closeAsk} questionId={askQid} />
      ) : null}
    </div>
  );
}

// Slice 1b: 解析问答入口在 Result 页. context_kind='session_result' + sessionId,
// 让 backend 知道用户复盘哪场答题. backend 当前 'session_result' 是 stub
// (Slice 2x 才实现 fetch context_text), Slice 1b PoC 阶段 model 拿 'general'
// 等价 — 不阻塞功能. 自己 useParams 拿 sessionId 不依赖父级 prop drilling.
function ResultAskAi() {
  const { sessionId: sessionIdStr } = useParams<{ sessionId: string }>();
  const [open, setOpen] = useState(false);
  const sessionIdNum =
    sessionIdStr !== undefined && /^\d+$/.test(sessionIdStr)
      ? Number(sessionIdStr)
      : null;
  return (
    <>
      <span className="fixed right-4 bottom-8 z-30">
        <Tooltip label={LLM_QA_COPY.askButton} side="left">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={LLM_QA_COPY.askButton}
            className={[
              'inline-flex h-11 w-11 items-center justify-center',
              'rounded-pill bg-ink text-surface shadow-pop',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            ].join(' ')}
            data-testid="result-ask-ai"
          >
            <HelpIcon className="h-5 w-5" />
          </button>
        </Tooltip>
      </span>
      <ChatPanel
        open={open}
        onClose={() => setOpen(false)}
        contextKind="session_result"
        contextId={sessionIdNum}
      />
    </>
  );
}
