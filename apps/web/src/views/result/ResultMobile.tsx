import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@sikao/api-client/request';
import type { PracticeSessionResultV2 } from '@sikao/api-client/types/api';
import {
  ActionNoteEditIcon,
  AlertCircleIcon,
  NavBackIcon,
  RefreshIcon,
  SubjectHomeIcon,
  ToolAiIcon,
  ToolEyeIcon,
} from '@sikao/ui/icons';
import { EmptyState } from '@sikao/ui/ui';
import { AskDrawer } from '@/components/ask/AskDrawer';
import { MvpButton, MvpCard, MvpPage } from '@/components/mvp';
import {
  ResultIconAction,
  ResultPageSkeleton,
} from '@/components/result';
import {
  buildResultOverview,
  buildWrongItems,
  pickTitle,
  plainTextStem,
} from '@/components/result/_resultHelpers';
import { ERROR_COPY, LLM_QA_COPY, RESULT_COPY } from '@/lib/ui-copy';
import { useApplyExamTheme } from '@/styles/useThemeStore';

export function ResultLoadingState() {
  return (
    <MvpPage title={RESULT_COPY.status.loadingTitle} hideHeading testId="result-loading">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <MvpCard className="p-6">
          <div className="h-4 w-28 animate-pulse rounded-card bg-paper-3" />
          <div className="mt-5 h-20 w-40 animate-pulse rounded-card bg-paper-3" />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="h-24 animate-pulse rounded-card bg-paper-2" />
            <div className="h-24 animate-pulse rounded-card bg-paper-2" />
            <div className="h-24 animate-pulse rounded-card bg-paper-2" />
          </div>
        </MvpCard>
        <MvpCard className="p-6">
          <div className="h-4 w-24 animate-pulse rounded-card bg-paper-3" />
          <div className="mt-5 h-40 animate-pulse rounded-card bg-paper-2" />
        </MvpCard>
      </div>
    </MvpPage>
  );
}

export function ResultErrorState({
  onRetry,
  onBackHome,
}: {
  readonly onRetry: () => void;
  readonly onBackHome: () => void;
}) {
  return (
    <MvpPage title={ERROR_COPY.result.title} hideHeading testId="result-error-view">
      <MvpCard className="mx-auto max-w-xl p-6" testId="result-error-card">
        <div className="flex items-start gap-4" role="alert" data-tone="error">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-bad-bg text-err">
            <AlertCircleIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-h3 font-bold text-ink">{ERROR_COPY.result.title}</h2>
            <p className="mt-1 text-small text-ink-3">{ERROR_COPY.result.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <MvpButton
                variant="primary"
                icon={<RefreshIcon className="h-4 w-4" />}
                onClick={onRetry}
                data-testid="result-retry"
              >
                {RESULT_COPY.status.retry}
              </MvpButton>
              <div className="flex items-center gap-2">
                <ResultIconAction
                  label={RESULT_COPY.status.home}
                  onClick={onBackHome}
                  testId="result-error-home"
                >
                  <SubjectHomeIcon className="h-4 w-4" />
                </ResultIconAction>
                <span className="text-small font-semibold text-ink-3">{RESULT_COPY.status.home}</span>
              </div>
            </div>
          </div>
        </div>
      </MvpCard>
    </MvpPage>
  );
}

function ResultMobileBody({
  result,
  onBackHome,
  onCaptureNote,
  onRetry,
  onViewWrong,
  retryDisabled,
  viewWrongDisabled,
}: {
  readonly result: PracticeSessionResultV2;
  readonly onBackHome: () => void;
  readonly onCaptureNote: () => void;
  readonly onRetry: () => void;
  readonly onViewWrong: () => void;
  readonly retryDisabled: boolean;
  readonly viewWrongDisabled: boolean;
}) {
  const title = pickTitle(result);
  const overview = useMemo(() => buildResultOverview(result), [result]);
  const durationMin =
    overview.durationSeconds !== undefined
      ? Math.max(1, Math.round(overview.durationSeconds / 60))
      : null;
  const wrongItems = useMemo(() => buildWrongItems(result), [result]);
  const previewWrong = wrongItems.slice(0, 3);
  const [askQid, setAskQid] = useState<string | null>(null);
  const openAsk = useCallback((qid: string): void => setAskQid(qid), []);
  const closeAsk = useCallback((): void => setAskQid(null), []);

  const nextStep = useMemo(() => {
    if (overview.outcome === 'all_correct') {
      return {
        title: RESULT_COPY.next.allCorrectTitle,
        description: RESULT_COPY.next.allCorrectDescription,
        actionLabel: RESULT_COPY.next.primaryRetry,
        actionIcon: <RefreshIcon className="h-4 w-4" />,
        onAction: onRetry,
        disabled: retryDisabled,
      };
    }
    return {
      title:
        overview.outcome === 'wrong_heavy'
          ? RESULT_COPY.next.wrongHeavyTitle
          : RESULT_COPY.next.wrongReviewTitle,
      description:
        overview.outcome === 'wrong_heavy'
          ? RESULT_COPY.next.wrongHeavyDescription
          : RESULT_COPY.next.wrongReviewDescription,
      actionLabel: RESULT_COPY.next.primaryWrong,
      actionIcon: <ToolEyeIcon className="h-4 w-4" />,
      onAction: onViewWrong,
      disabled: viewWrongDisabled,
    };
  }, [onRetry, onViewWrong, overview.outcome, retryDisabled, viewWrongDisabled]);

  return (
    <div className="m-pbody min-h-full pb-6" data-testid="result-mobile-view">
      <header className="m-app-head">
        <button
          type="button"
          className="m-app-head__icon-btn"
          aria-label={RESULT_COPY.status.homeMobile}
          onClick={onBackHome}
        >
          <NavBackIcon size={20} />
        </button>
        <div className="min-w-0 flex-1 px-2 text-center">
          <p className="m-app-head__sub m-0 leading-tight">{RESULT_COPY.header.mobileEyebrow}</p>
          <h1 className="m-app-head__title truncate" title={title}>
            {title}
          </h1>
        </div>
        <span className="m-app-head__icon-btn" aria-hidden="true" />
      </header>

      <section
        className="result-hero"
        data-testid="result-mobile-hero"
        aria-label={RESULT_COPY.hero.accuracyLabel}
      >
        <div className="result-hero__label">{RESULT_COPY.hero.accuracyLabel}</div>
        <div className="result-hero__big">
          {overview.accuracyPct}
          <span className="result-hero__big-unit">%</span>
        </div>
        <div className="result-hero__delta text-ink-3">
          {RESULT_COPY.hero.scorePrefix} {result.score}
        </div>
      </section>

      <section
        className="mstat-row"
        data-testid="result-mobile-mstat"
        aria-label="本次练习统计"
      >
        <div className="mstat">
          <div className="mstat__label">{RESULT_COPY.metrics.duration}</div>
          <div className="mstat__value">
            {durationMin !== null ? durationMin : RESULT_COPY.metrics.emptyDelta}
            {durationMin !== null ? (
              <span className="mstat__unit">{RESULT_COPY.metrics.durationUnit}</span>
            ) : null}
          </div>
          <div className="mstat__delta mstat__delta--flat">{RESULT_COPY.metrics.emptyDelta}</div>
        </div>
        <div className="mstat">
          <div className="mstat__label">{RESULT_COPY.metrics.answered}</div>
          <div className="mstat__value">
            {overview.answeredCount}
            <span className="mstat__unit">题</span>
          </div>
          <div className="mstat__delta mstat__delta--flat">
            {RESULT_COPY.metrics.answeredPrefix} {overview.totalQuestionCount}
          </div>
        </div>
        <div className="mstat">
          <div className="mstat__label">{RESULT_COPY.metrics.newWrong}</div>
          <div className={`mstat__value ${result.incorrectCount > 0 ? 'text-err' : 'text-ink'}`}>
            {result.incorrectCount}
            <span className="mstat__unit">题</span>
          </div>
          <div className="mstat__delta mstat__delta--flat">
            {result.incorrectCount > 0
              ? RESULT_COPY.metrics.addedToBook
              : RESULT_COPY.metrics.emptyDelta}
          </div>
        </div>
      </section>

      {wrongItems.length > 0 ? (
        <>
          <div className="m-section-head" data-testid="result-mobile-wrong-head">
            <div>
              <h2>{RESULT_COPY.mobile.wrongTitle}</h2>
              <p className="mt-1 text-tiny font-semibold text-ink-3">
                {RESULT_COPY.mobile.viewAll(wrongItems.length)}
              </p>
            </div>
            <ResultIconAction
              label={RESULT_COPY.actionsViewWrong}
              onClick={onViewWrong}
              disabled={viewWrongDisabled}
              size="md"
              testId="result-mobile-view-all"
            >
              <ToolEyeIcon className="h-4 w-4" />
            </ResultIconAction>
          </div>
          <section className="m-card px-4 py-2" data-testid="result-mobile-wrong-list">
            {previewWrong.map((item) => {
              const qid = String(item.question.questionId);
              return (
                <div
                  key={qid}
                  className="m-list-row flex items-start gap-3"
                  data-testid={`result-mobile-wrong-${item.questionNo}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="m-list-row__title truncate">
                      {item.questionNo} 路 {plainTextStem(String(item.question.content.stem)).slice(0, 30)}
                    </div>
                    <div className="m-list-row__meta">
                      {RESULT_COPY.mobile.youChose}{' '}
                      <b className="text-err">{item.userKeys.join('')}</b> 路{' '}
                      {RESULT_COPY.mobile.correctAnswer}{' '}
                      <b className="text-ok">{item.correctKeys.join('')}</b>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="m-list-row__right m-list-row__right--err">
                      {RESULT_COPY.mobile.wrongMark}
                    </span>
                    <ResultIconAction
                      label={RESULT_COPY.mobile.viewWrongAria(item.questionNo)}
                      onClick={onViewWrong}
                      disabled={viewWrongDisabled}
                      size="md"
                      testId={`result-mobile-view-wrong-${item.questionNo}`}
                    >
                      <ToolEyeIcon className="h-4 w-4" />
                    </ResultIconAction>
                    <ResultIconAction
                      label={RESULT_COPY.mobile.askAria(LLM_QA_COPY.askButton, item.questionNo)}
                      onClick={() => openAsk(qid)}
                      size="md"
                      testId={`result-mobile-ask-${item.questionNo}`}
                    >
                      <ToolAiIcon className="h-4 w-4" />
                    </ResultIconAction>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      ) : (
        <section className="m-card" data-testid="result-mobile-no-wrong">
          <p className="m-0 text-sm text-ink-3">{RESULT_COPY.mobile.noWrong}</p>
        </section>
      )}

      <section
        className="mt-4 rounded-card border border-line bg-paper-2 p-4"
        data-testid={RESULT_COPY.mobile.nextCardTestId}
      >
        <p className="text-tiny font-semibold uppercase tracking-eyebrow text-ink-3">
          {RESULT_COPY.next.eyebrow}
        </p>
        <h2 className="mt-2 text-h3 font-bold text-ink">{nextStep.title}</h2>
        <p className="mt-2 text-small leading-6 text-ink-3">{nextStep.description}</p>
        <div className="mt-4">
          <MvpButton
            variant="primary"
            className="w-full"
            icon={nextStep.actionIcon}
            onClick={nextStep.onAction}
            disabled={nextStep.disabled}
            data-testid={RESULT_COPY.mobile.primaryActionTestId}
          >
            {nextStep.actionLabel}
          </MvpButton>
        </div>
        <div className="mt-4 flex items-start justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <ResultIconAction
              label={RESULT_COPY.next.note}
              onClick={onCaptureNote}
              size="md"
              testId={RESULT_COPY.mobile.notesActionTestId}
            >
              <ActionNoteEditIcon className="h-4 w-4" />
            </ResultIconAction>
            <span className="text-tiny font-semibold text-ink-3">{RESULT_COPY.next.note}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ResultIconAction
              label={RESULT_COPY.status.homeMobile}
              onClick={onBackHome}
              size="md"
              testId="result-mobile-home"
            >
              <SubjectHomeIcon className="h-4 w-4" />
            </ResultIconAction>
            <span className="text-tiny font-semibold text-ink-3">{RESULT_COPY.status.homeMobile}</span>
          </div>
        </div>
      </section>

      {askQid !== null ? (
        <AskDrawer open={true} onClose={closeAsk} questionId={askQid} />
      ) : null}
    </div>
  );
}

export function ResultMobile() {
  useApplyExamTheme();
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

  const onBackHome = useCallback(() => navigate('/app'), [navigate]);
  const onCaptureNote = useCallback(() => navigate('/notes'), [navigate]);
  const paperCode = query.data?.session?.paperCode ?? null;
  const onRetry = useCallback(() => {
    if (paperCode === null) return;
    navigate(`/practice/${paperCode}/start`);
  }, [paperCode, navigate]);
  const onViewWrong = useCallback(() => {
    if (paperCode === null) return;
    navigate(`/wrong-book?paperCode=${encodeURIComponent(paperCode)}`);
  }, [paperCode, navigate]);

  if (query.isLoading) return <ResultPageSkeleton />;
  if (query.isError || query.data === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={ERROR_COPY.result.title}
          description={ERROR_COPY.result.description}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <MvpButton
                variant="primary"
                icon={<RefreshIcon className="h-4 w-4" />}
                onClick={() => {
                  void query.refetch();
                }}
                data-testid="result-mobile-retry-fetch"
              >
                {RESULT_COPY.status.retry}
              </MvpButton>
              <div className="flex items-center gap-2">
                <ResultIconAction
                  label={RESULT_COPY.status.homeMobile}
                  onClick={onBackHome}
                  testId="result-mobile-error-home"
                >
                  <SubjectHomeIcon className="h-4 w-4" />
                </ResultIconAction>
                <span className="text-small font-semibold text-ink-3">{RESULT_COPY.status.homeMobile}</span>
              </div>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <ResultMobileBody
      result={query.data}
      onBackHome={onBackHome}
      onCaptureNote={onCaptureNote}
      onRetry={onRetry}
      onViewWrong={onViewWrong}
      retryDisabled={paperCode === null}
      viewWrongDisabled={paperCode === null}
    />
  );
}
