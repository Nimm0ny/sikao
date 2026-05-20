// EssayGradingResult — Slice 2d /essay/grades/:recordId 申论批改报告 view.
//
//   - essay-res grid 1fr/320px 双段 layout
//   - 主区: <EssayResultHero> + <QuestionBreakdown> (单 record = 1 行 5 维)
//           + <EssayThinkBlock> (suggestions/strengths) + <SampleAnswerCard>
//   - 右栏: <EssayResultAside> (总览 / 评分细项 / CTA)
//
// useQuery refetchInterval=1s 轮询 status: pending → completed/failed 后停.
// 三态 dispatch:
//   pending   → EssayGradingPending (loader + 30s slow hint)
//   failed    → EssayGradingFailed (product copy + retry button 走新 record)
//
// retry on failed: 拉原 question.answerText (已落 record.answerText), 走
// POST /grade 创新 record + navigate(/grades/new-id). 旧 record immutable.

import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircleIcon, NavBackIcon, RefreshIcon } from '@sikao/ui/icons';
import { Breadcrumb, Button, EmptyState, PageHeader, Skeleton } from '@sikao/ui/ui';
import { EssayGradingPending } from '@/components/essay/EssayGradingPending';
import { EssayGradingFailed } from '@/components/essay/EssayGradingFailed';
import { SampleAnswerCard } from '@/components/essay/SampleAnswerCard';
import {
  EssayResultHero,
  QuestionBreakdown,
  EssayThinkBlock,
  EssayResultAside,
  StatRow,
  buildGradingLbl,
  buildGradingSubtitle,
  buildSingleRecordItem,
  pickResultHeadline,
  pickThinkTitle,
  buildThinkParagraphs,
  buildGradingOverviewRows,
  buildGradingDimensionRows,
  type QuestionBreakdownItem,
  type AsideCardSection,
} from '@/components/result';
import {
  essayGradingKeys,
  fetchEssayGrading,
  submitEssayGrading,
} from '@sikao/api-client/apiQueries';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { trackEvent } from '@/lib/analytics';
import { ERROR_COPY, ESSAY_GRADING_COPY } from '@/lib/ui-copy';
import { useApplyExamTheme } from '@/styles/useThemeStore';
import type { EssayFeedbackV2, EssayGradingV2 } from '@sikao/api-client/types/api';

const POLL_INTERVAL_MS = 1000;

export default function EssayGradingResult() {
  useApplyExamTheme();
  const { recordId: rawId } = useParams<{ recordId: string }>();
  const recordId = rawId !== undefined ? Number(rawId) : NaN;
  const navigate = useNavigate();

  const query = useQuery<EssayGradingV2>({
    queryKey: essayGradingKeys.detail(recordId),
    queryFn: () => fetchEssayGrading(recordId),
    enabled: Number.isFinite(recordId),
    // pending 时轮询 1s; completed/failed 后停.
    refetchInterval: (q) =>
      q.state.data?.status === 'pending' ? POLL_INTERVAL_MS : false,
    refetchOnWindowFocus: false,
  });

  // mutation 接受 questionId + answerText 作参数 (而非 closure 上 query.data!),
  // 避免非空断言 + 让 caller 显式传 — strict mode 风格一致 (review P1-2).
  const retryMutation = useMutation({
    mutationFn: (input: { questionId: number; answerText: string }) =>
      submitEssayGrading(input),
    onSuccess: (newRecord) => {
      navigate(`/essay/grades/${newRecord.id}`);
    },
    onError: (err) => {
      // 跟 EssayPractice submitMutation onError 一样不 re-throw — useMutation
      // 自身 isError state 已 first-class.
      logger.error('essay.grade.retry_failed', { recordId, err: String(err) });
      toast.error(ESSAY_GRADING_COPY.retryFailedTitle, ESSAY_GRADING_COPY.retryFailedDesc);
    },
  });

  const handleRetry = useCallback(() => {
    if (query.data === undefined || retryMutation.isPending) return;
    retryMutation.mutate({
      questionId: query.data.questionId,
      answerText: query.data.answerText,
    });
  }, [query.data, retryMutation]);

  const onBackHistory = useCallback(() => navigate('/essay/history'), [navigate]);
  const handlePrint = useCallback(() => window.print(), []);
  const handlePracticeAgain = useCallback(
    (questionId: number) => navigate(`/essay/specialty/${questionId}`),
    [navigate],
  );
  const trackedRecord = query.data;

  useEffect(() => {
    if (trackedRecord?.status !== 'completed') return;
    trackEvent({
      eventName: 'essay_grading_viewed',
      sessionId: String(trackedRecord.id),
      properties: {
        recordId: String(trackedRecord.id),
        questionId: String(trackedRecord.questionId),
        score:
          trackedRecord.score == null ? 'none' : String(trackedRecord.score),
      },
    });
  }, [trackedRecord]);

  if (!Number.isFinite(recordId)) {
    return (
      <PageFrame>
        <PageHeader title={ESSAY_GRADING_COPY.resultTitle} />
        <div className="mt-6">
          <EmptyState
            icon={<AlertCircleIcon className="w-8 h-8" />}
            title={ERROR_COPY.paperNotFound.title}
            description={ESSAY_GRADING_COPY.resultInvalidLinkDesc}
            action={
              <Button variant="quiet" onClick={onBackHistory}>
                {ESSAY_GRADING_COPY.resultActionBack}
              </Button>
            }
          />
        </div>
      </PageFrame>
    );
  }

  if (query.isLoading) {
    return (
      <PageFrame>
        <PageHeader title={ESSAY_GRADING_COPY.resultTitle} />
        <div className="mt-6">
          <Skeleton heightClass="h-96" />
        </div>
      </PageFrame>
    );
  }

  if (query.isError || query.data === undefined) {
    return (
      <PageFrame>
        <PageHeader title={ESSAY_GRADING_COPY.resultTitle} />
        <div className="mt-6">
          <EmptyState
            tone="error"
            icon={<AlertCircleIcon className="w-8 h-8" />}
            title={ERROR_COPY.paperLoad.title}
            description={ERROR_COPY.paperLoad.description}
            action={
              <Button
                variant="secondary"
                onClick={() => { void query.refetch(); }}
                data-testid="essay-grading-result-retry"
              >
                <RefreshIcon className="w-4 h-4 mr-2" />
                重试
              </Button>
            }
          />
        </div>
      </PageFrame>
    );
  }

  const record = query.data;
  // backend Pydantic UtcDatetime 强校验 ISO, Date.parse 不会 NaN — 不补
  // defensive Date.now() 兜底 (CLAUDE.md "Don't add error handling for
  // scenarios that can't happen").
  const startedAt = Date.parse(record.createdAt);

  return (
    <PageFrame>
      <Breadcrumb
        items={[
          { label: '我的申论', href: '/essay/history' },
          { label: `record #${record.id}` },
        ]}
      />
      <PageHeader
        className="mt-4"
        title={ESSAY_GRADING_COPY.resultTitle}
        actions={
          <Button
            variant="quiet"
            size="sm"
            onClick={onBackHistory}
            data-testid="essay-grading-result-back"
          >
            <NavBackIcon className="w-4 h-4 mr-1" />
            {ESSAY_GRADING_COPY.historyTitle}
          </Button>
        }
      />

      {record.status === 'pending' ? (
        <div className="mt-6" data-testid="essay-grading-result-pending">
          <EssayGradingPending startedAt={startedAt} />
        </div>
      ) : record.status === 'failed' ? (
        <div className="mt-6" data-testid="essay-grading-result-failed">
          <EssayGradingFailed
            failureReason={record.failureReason}
            onRetry={handleRetry}
            isRetrying={retryMutation.isPending}
          />
        </div>
      ) : record.feedback !== null ? (
        <div
          className="mt-6"
          data-testid="essay-grading-result-completed"
        >
          <CompletedReport
            record={record}
            feedback={record.feedback}
            onPracticeAgain={handlePracticeAgain}
            onPrint={handlePrint}
            onBackHistory={onBackHistory}
          />
        </div>
      ) : (
        // completed 但 feedback null — backend bug, ops log + 用户看占位
        <div className="mt-6" data-testid="essay-grading-result-no-feedback">
          <EmptyState
            tone="error"
            icon={<AlertCircleIcon className="w-8 h-8" />}
            title={ESSAY_GRADING_COPY.resultDataErrorTitle}
            description={ESSAY_GRADING_COPY.resultDataErrorDesc}
          />
        </div>
      )}
    </PageFrame>
  );
}

interface CompletedReportProps {
  readonly record: EssayGradingV2;
  readonly feedback: EssayFeedbackV2;
  readonly onPracticeAgain: (questionId: number) => void;
  readonly onPrint: () => void;
  readonly onBackHistory: () => void;
}

function CompletedReport({
  record,
  feedback,
  onPracticeAgain,
  onPrint,
  onBackHistory,
}: CompletedReportProps) {
  const score = feedback.overallScore;
  const charCount = record.answerText.length;
  const lbl = useMemo(() => buildGradingLbl(record), [record]);
  const headline = useMemo(() => pickResultHeadline(score), [score]);
  const subtitle = useMemo(
    () => buildGradingSubtitle(feedback),
    [feedback],
  );

  // 单 record 模式: 把 5 维度作为 1 个 qrow 的 rubrics 渲染.
  // qnumLabel = 题号 (单题不知 paper position, 用 "申论 · 此题"); qkindLabel
  // 同样 fallback ("综合评分"). 多 record 模式 (EssayExamResults) 由那边
  // 自己拼装更精细的 qkind.
  const breakdownItem = useMemo<QuestionBreakdownItem>(() => {
    return buildSingleRecordItem(record, feedback);
  }, [record, feedback]);

  const asideCards = useMemo<readonly AsideCardSection[]>(() => {
    const overviewRows = buildGradingOverviewRows(record, feedback, charCount);
    const dimensionRows = buildGradingDimensionRows(feedback);
    const overviewBody = (
      <>
        {overviewRows.map((r) => (
          <StatRow
            key={r.kind}
            label={r.label}
            value={r.value}
            testId={r.testId}
            last={r.last}
          />
        ))}
      </>
    );
    const dimensionsBody = (
      <>
        {dimensionRows.map((r) => (
          <StatRow
            key={r.label}
            label={r.label}
            value={r.value}
            tone={r.tone}
            last={r.last}
            testId={r.testId}
          />
        ))}
      </>
    );
    return [
      {
        title: '总览',
        subtitle: '本题',
        body: overviewBody,
        testIdSuffix: 'overview',
      },
      {
        title: '5 维度明细',
        subtitle: '论点 → 字数',
        body: dimensionsBody,
        testIdSuffix: 'dimensions',
      },
    ];
  }, [record, feedback, charCount]);

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        columnGap: '48px',
      }}
    >
      <div>
        <EssayResultHero
          score={score}
          maxScore={100}
          eyebrow={`Report · 申论 · record #${record.id}`}
          lbl={lbl}
          headline={headline}
          subtitle={subtitle}
        />

        {feedback.suspicious ? (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 px-3 py-2 border border-warn text-warn text-sm font-mono bg-warn-bg"
            style={{ letterSpacing: 'var(--tracking-loose)' }}
            data-testid="essay-grading-suspicious-banner"
          >
            <AlertCircleIcon className="w-4 h-4 shrink-0" />
            <span>{ESSAY_GRADING_COPY.suspiciousBanner}</span>
          </div>
        ) : null}

        <h3
          className="font-serif"
          style={{
            fontSize: '22px',
            fontWeight: 500,
            margin: '0 0 16px',
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--ink-1)',
          }}
        >
          评分细项 · 5 维度
        </h3>
        <QuestionBreakdown items={[breakdownItem]} />

        {feedback.suggestions.length > 0 || feedback.strengths.length > 0 ? (
          <EssayThinkBlock
            tag="AI · 思考"
            title={pickThinkTitle(feedback)}
            paragraphs={buildThinkParagraphs(feedback)}
          />
        ) : null}

        <SampleAnswerCard sampleAnswer={feedback.sampleAnswer} />

        <ResultActions
          questionId={record.questionId}
          onPracticeAgain={onPracticeAgain}
          onPrint={onPrint}
          onBackHistory={onBackHistory}
        />
      </div>

      <EssayResultAside cards={asideCards} />
    </div>
  );
}

function ResultActions({
  questionId,
  onPracticeAgain,
  onPrint,
  onBackHistory,
}: {
  readonly questionId: number;
  readonly onPracticeAgain: (questionId: number) => void;
  readonly onPrint: () => void;
  readonly onBackHistory: () => void;
}) {
  return (
    <div
      className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="essay-grading-result-actions"
    >
      <Button
        variant="primary"
        onClick={() => onPracticeAgain(questionId)}
        data-testid="essay-grading-result-practice-again"
      >
        <RefreshIcon className="w-4 h-4 mr-2" />
        {ESSAY_GRADING_COPY.resultActionPractice}
      </Button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          variant="secondary"
          onClick={onPrint}
          data-testid="essay-grading-result-print"
        >
          {ESSAY_GRADING_COPY.resultActionPrint}
        </Button>
        <Button
          variant="quiet"
          onClick={onBackHistory}
          data-testid="essay-grading-result-actions-back"
        >
          {ESSAY_GRADING_COPY.resultActionBack}
        </Button>
      </div>
    </div>
  );
}

function PageFrame({ children }: { readonly children: React.ReactNode }) {
  return <div className="p-4 md:p-8 max-w-6xl mx-auto">{children}</div>;
}
