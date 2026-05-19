import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDevice } from '@sikao/shared-utils/hooks/useDevice';
import {
  ActionNoteEditIcon,
  CpuIcon,
  RefreshIcon,
  SubjectHomeIcon,
  SubjectPlanIcon,
  ToolAiIcon,
  ToolEyeIcon,
} from '@sikao/ui/icons';
import { api } from '@sikao/api-client/request';
import { logger, toast } from '@sikao/shared-utils';
import type { PracticeSessionResultV2 } from '@sikao/api-client/types/api';
import { ChatPanel } from '@/components/llm/ChatPanel';
import {
  buildResultOverview,
  buildWeakRows,
  buildWrongItems,
  formatDurationMinutes,
  pickTitle,
  plainTextStem,
} from '@/components/result/_resultHelpers';
import {
  getWrongReasonLabel,
  WRONG_REASON_OPTIONS,
  type WrongReasonCode,
} from '@/components/result/wrongReason';
import { RESULT_COPY } from '@/lib/ui-copy';
import { MvpButton, MvpCard, MvpChip, MvpPage, MvpProgressRing } from '@/components/mvp';
import { ResultIconAction, ResultSupportCard } from '@/components/result';
import { ResultErrorState, ResultLoadingState, ResultMobile } from './result/ResultMobile';

interface UseResultActionsArgs {
  readonly sessionData: PracticeSessionResultV2 | undefined;
  readonly navigate: (to: string) => void;
}

function useResultActions({ sessionData, navigate }: UseResultActionsArgs) {
  const onBackHome = useCallback(() => navigate('/dashboard'), [navigate]);
  const paperCode = sessionData?.session?.paperCode ?? null;
  const onRetry = useCallback(() => {
    if (paperCode === null) return;
    navigate(`/practice/${paperCode}/start`);
  }, [paperCode, navigate]);
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

export default function Result() {
  const device = useDevice();
  if (device === 'mobile') return <ResultMobile />;
  return <ResultDesktop />;
}

function ResultDesktop() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const query = useQuery<PracticeSessionResultV2>({
    queryKey: ['practiceResult', sessionId],
    queryFn: () =>
      api.get<PracticeSessionResultV2>(
        `/practice/sessions/${sessionId ?? ''}/result`,
      ),
    enabled: sessionId !== undefined,
  });
  const actions = useResultActions({ sessionData: query.data, navigate });

  if (query.isLoading) return <ResultLoadingState />;
  if (query.isError || query.data === undefined) {
    return (
      <ResultErrorState
        onRetry={() => {
          void query.refetch();
        }}
        onBackHome={actions.onBackHome}
      />
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

function ResultBody({
  result,
  onBackHome,
  onRetry,
  onViewWrong,
  retryDisabled,
  viewWrongDisabled,
}: ResultBodyProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [chatOpen, setChatOpen] = useState(false);
  const [savingAnswerId, setSavingAnswerId] = useState<number | null>(null);
  const syncedWrongReasonIdsRef = useRef<Set<number>>(new Set());
  const resultSessionId = result.sessionId ?? result.session?.sessionId ?? null;
  const overview = useMemo(() => buildResultOverview(result), [result]);
  const wrongItems = useMemo(() => buildWrongItems(result), [result]);
  const weakRows = useMemo(() => buildWeakRows(result), [result]);
  const title = pickTitle(result);
  const nextStep =
    overview.outcome === 'all_correct'
      ? { title: RESULT_COPY.next.allCorrectTitle, description: RESULT_COPY.next.allCorrectDescription }
      : overview.outcome === 'wrong_heavy'
        ? { title: RESULT_COPY.next.wrongHeavyTitle, description: RESULT_COPY.next.wrongHeavyDescription }
        : { title: RESULT_COPY.next.wrongReviewTitle, description: RESULT_COPY.next.wrongReviewDescription };
  const nextSummary =
    wrongItems.length > 0
      ? RESULT_COPY.next.pendingWrong(wrongItems.length)
      : RESULT_COPY.next.noWrong;

  const mergeWrongReasonIntoCache = useCallback(
    (answerId: number, wrongReasonCode: WrongReasonCode, source: 'ai' | 'user') => {
      if (resultSessionId === null) return;
      queryClient.setQueryData<PracticeSessionResultV2>(
        ['practiceResult', String(resultSessionId)],
        (previous) => {
          if (previous?.answers === undefined) return previous;
          return {
            ...previous,
            answers: previous.answers.map((answer) =>
              Number(answer.id) === answerId
                ? { ...answer, wrongReasonCode, wrongReasonSource: source }
                : answer,
            ),
          };
        },
      );
    },
    [queryClient, resultSessionId],
  );

  const saveWrongReason = useCallback(
    async (answerId: number, wrongReasonCode: WrongReasonCode, source: 'ai' | 'user') => {
      if (resultSessionId === null) return;
      await api.patch(`/practice/sessions/${resultSessionId}/answers/${answerId}/diagnosis`, {
        wrongReasonCode,
        source,
      });
      mergeWrongReasonIntoCache(answerId, wrongReasonCode, source);
    },
    [mergeWrongReasonIntoCache, resultSessionId],
  );

  useEffect(() => {
    wrongItems.forEach((item) => {
      if (
        item.answerId === undefined ||
        item.wrongReasonCode === undefined ||
        item.needsDiagnosisSync !== true ||
        syncedWrongReasonIdsRef.current.has(item.answerId)
      ) {
        return;
      }
      syncedWrongReasonIdsRef.current.add(item.answerId);
      void saveWrongReason(item.answerId, item.wrongReasonCode, 'ai').catch((err) => {
        logger.error('result.auto_wrong_reason_failed', {
          answerId: item.answerId,
          err: String(err),
        });
      });
    });
  }, [saveWrongReason, wrongItems]);

  const handleSetWrongReason = useCallback(
    (answerId: number, wrongReasonCode: WrongReasonCode): void => {
      setSavingAnswerId(answerId);
      void saveWrongReason(answerId, wrongReasonCode, 'user')
        .catch((err) => {
          logger.error('result.wrong_reason_save_failed', {
            answerId,
            err: String(err),
          });
          toast.error('错因保存失败', '请稍后重试');
        })
        .finally(() => {
          setSavingAnswerId((current) => (current === answerId ? null : current));
        });
    },
    [saveWrongReason],
  );

  return (
    <MvpPage title={RESULT_COPY.status.loadingTitle} hideHeading testId="result-view">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <MvpCard className="p-6 md:p-8" testId="result-score-card">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <MvpChip tone="blue">{RESULT_COPY.header.badge}</MvpChip>
                {result.session?.paperCode ? <MvpChip>{result.session.paperCode}</MvpChip> : null}
              </div>
              <h1 className="mt-4 truncate text-h1 font-bold text-ink" title={title}>
                {title}
              </h1>
            </div>
            <MvpProgressRing value={overview.accuracyPct} label={RESULT_COPY.hero.accuracyLabel} />
          </div>

          <div className="mt-8 flex items-end gap-3">
            <span className="text-display font-bold leading-none text-ink" data-testid="result-score-value">
              {result.score}
            </span>
            <span className="pb-2 text-small font-semibold text-ink-3">{RESULT_COPY.hero.scoreUnit}</span>
            {overview.durationSeconds !== undefined ? (
              <MvpChip>{formatDurationMinutes(overview.durationSeconds)}</MvpChip>
            ) : null}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <ResultMetric label={RESULT_COPY.metrics.correct} value={result.correctCount} tone="green" />
            <ResultMetric label={RESULT_COPY.metrics.wrong} value={result.incorrectCount} tone="red" />
            <ResultMetric label={RESULT_COPY.metrics.unanswered} value={result.unansweredCount} tone="amber" />
            <ResultMetric label={RESULT_COPY.metrics.total} value={overview.totalQuestionCount} tone="blue" />
          </div>
        </MvpCard>

        <MvpCard className="p-6" testId="result-next-card">
          <p className="text-tiny font-semibold uppercase tracking-eyebrow text-ink-3">
            {RESULT_COPY.next.eyebrow}
          </p>
          <h2 className="mt-3 text-h3 font-bold text-ink">{nextStep.title}</h2>
          <p className="mt-2 text-small leading-6 text-ink-3">{nextStep.description}</p>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-card border border-line bg-paper-2 p-4">
            <div>
              <p className="text-small font-semibold text-ink">{RESULT_COPY.next.title}</p>
              <p className="mt-1 text-small text-ink-3">{nextSummary}</p>
            </div>
            <MvpButton
              variant="primary"
              icon={
                overview.outcome === 'all_correct' ? (
                  <RefreshIcon className="h-4 w-4" />
                ) : (
                  <ToolEyeIcon className="h-4 w-4" />
                )
              }
              onClick={overview.outcome === 'all_correct' ? onRetry : onViewWrong}
              disabled={overview.outcome === 'all_correct' ? retryDisabled : viewWrongDisabled}
              data-testid={overview.outcome === 'all_correct' ? 'result-next-practice' : 'result-view-wrong'}
            >
              {overview.outcome === 'all_correct'
                ? RESULT_COPY.next.primaryRetry
                : RESULT_COPY.next.primaryWrong}
            </MvpButton>
          </div>
          <div className="mt-5 grid gap-2">
            {[
              {
                label: RESULT_COPY.next.retry,
                icon: <RefreshIcon className="h-4 w-4" />,
                onClick: onRetry,
                disabled: retryDisabled,
                testId: 'result-retry',
              },
              {
                label: RESULT_COPY.next.plan,
                icon: <SubjectPlanIcon className="h-4 w-4" />,
                onClick: () => navigate('/plan'),
                disabled: false,
                testId: 'result-go-plan',
              },
              {
                label: RESULT_COPY.next.home,
                icon: <SubjectHomeIcon className="h-4 w-4" />,
                onClick: onBackHome,
                disabled: false,
                testId: 'result-back-home',
              },
            ].map((action) => (
              <div
                key={action.testId}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-3 py-2.5"
              >
                <span className="text-small font-semibold text-ink">{action.label}</span>
                <ResultIconAction
                  label={action.label}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  testId={action.testId}
                >
                  {action.icon}
                </ResultIconAction>
              </div>
            ))}
          </div>
        </MvpCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <MvpCard className="p-6" testId="result-wrong-card">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-h3 font-bold text-ink">{RESULT_COPY.review.title}</h2>
            <MvpChip tone={wrongItems.length > 0 ? 'amber' : 'green'}>
              {wrongItems.length > 0
                ? RESULT_COPY.review.wrongChip(wrongItems.length)
                : RESULT_COPY.review.clear}
            </MvpChip>
          </div>
          <div className="mt-4 divide-y divide-line">
            {wrongItems.length === 0 ? (
              <div className="rounded-card bg-paper-2 p-4 text-small font-semibold text-ink-3" data-testid="result-no-wrong">
                {RESULT_COPY.review.empty}
              </div>
            ) : (
              wrongItems.slice(0, 5).map((item) => (
                <WrongRow
                  key={String(item.question.questionId)}
                  item={item}
                  onSetWrongReason={handleSetWrongReason}
                  savingAnswerId={savingAnswerId}
                />
              ))
            )}
          </div>
        </MvpCard>

        <MvpCard className="p-6" testId="result-weak-card">
          <h2 className="text-h3 font-bold text-ink">{RESULT_COPY.weak.title}</h2>
          <div className="mt-4 space-y-3">
            {weakRows.length === 0 ? (
              <div className="rounded-card bg-paper-2 p-4 text-small font-semibold text-ink-3">
                {RESULT_COPY.weak.empty}
              </div>
            ) : (
              weakRows.map((row) => (
                <div key={`${row.label}-${row.accuracy}`} className="rounded-card border border-line bg-paper-2 p-3">
                  <div className="flex items-center justify-between gap-3 text-small">
                    <span className="min-w-0 truncate font-semibold text-ink" title={row.label}>
                      {row.label}
                    </span>
                    <span className="shrink-0 font-bold text-accent">{Math.round(row.accuracy)}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-pill bg-paper-3">
                    <div className="h-full rounded-pill bg-accent" style={{ width: `${Math.max(0, Math.min(100, row.accuracy))}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </MvpCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <ResultSupportCard
          icon={<ActionNoteEditIcon className="h-5 w-5" />}
          title={RESULT_COPY.actions.notesTitle}
          description={RESULT_COPY.actions.notesDescription}
          actionLabel={RESULT_COPY.actions.notesLabel}
          actionIcon={<ActionNoteEditIcon className="h-4 w-4" />}
          onAction={() => navigate('/notes')}
          actionTestId="result-notes-action-btn"
          testId="result-notes-action"
        />
        <ResultSupportCard
          icon={<SubjectPlanIcon className="h-5 w-5" />}
          title={RESULT_COPY.actions.planTitle}
          description={RESULT_COPY.actions.planDescription}
          actionLabel={RESULT_COPY.actions.planLabel}
          actionIcon={<SubjectPlanIcon className="h-4 w-4" />}
          onAction={() => navigate('/plan')}
          actionTestId="result-plan-action-btn"
          testId="result-plan-action"
        />
        <ResultSupportCard
          icon={<CpuIcon className="h-5 w-5" />}
          title={RESULT_COPY.actions.aiTitle}
          description={RESULT_COPY.actions.aiDescription}
          actionLabel={RESULT_COPY.actions.aiLabel}
          actionAriaLabel={RESULT_COPY.actions.aiTitle}
          actionIcon={<ToolAiIcon className="h-4 w-4" />}
          onAction={() => setChatOpen(true)}
          actionTestId="result-ai-action-btn"
          testId="result-ai-action"
        />
      </div>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        contextKind="session_result"
        contextId={typeof resultSessionId === 'number' ? resultSessionId : Number(resultSessionId)}
      />
    </MvpPage>
  );
}

function ResultMetric({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: number;
  readonly tone: 'green' | 'red' | 'amber' | 'blue';
}) {
  const color =
    tone === 'green'
      ? 'text-ok'
      : tone === 'red'
        ? 'text-err'
        : tone === 'amber'
          ? 'text-warn'
          : 'text-accent';
  return (
    <div className="rounded-card border border-line bg-paper-2 p-4">
      <p className="text-meta font-semibold text-ink-3">{label}</p>
      <p className={`mt-2 text-h2 font-bold ${color}`}>{value}</p>
    </div>
  );
}

function WrongRow({
  item,
  onSetWrongReason,
  savingAnswerId,
}: {
  readonly item: ReturnType<typeof buildWrongItems>[number];
  readonly onSetWrongReason: (answerId: number, code: WrongReasonCode) => void;
  readonly savingAnswerId: number | null;
}) {
  const answerId = item.answerId;
  const value = item.wrongReasonCode ?? 'other';
  return (
    <div className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_180px] md:items-center" data-testid={`wrong-review-${item.questionNo}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <MvpChip>{RESULT_COPY.review.questionLabel(item.questionNo)}</MvpChip>
          {item.categoryLabel ? <MvpChip tone="blue">{item.categoryLabel}</MvpChip> : null}
        </div>
        <p className="mt-2 truncate text-small font-semibold text-ink" title={plainTextStem(item.question.content.stem)}>
          {plainTextStem(item.question.content.stem)}
        </p>
        <p className="mt-1 text-meta font-semibold text-ink-3">
          {RESULT_COPY.review.selectedPrefix} {item.userKeys.join('') || '-'} / {RESULT_COPY.review.correctPrefix}{' '}
          {item.correctKeys.join('') || '-'}
        </p>
      </div>
      {answerId !== undefined ? (
        <select
          value={value}
          disabled={savingAnswerId === answerId}
          onChange={(event) => onSetWrongReason(answerId, event.target.value as WrongReasonCode)}
          className="min-h-10 rounded-tiny border border-line-3 bg-paper px-3 text-small font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={RESULT_COPY.review.reasonAria(item.questionNo)}
          data-testid={`wrong-reason-select-${answerId}`}
        >
          {WRONG_REASON_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {getWrongReasonLabel(option.code)}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
