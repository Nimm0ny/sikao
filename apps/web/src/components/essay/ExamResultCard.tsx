// ExamResultCard — 整卷模考成绩单单卡 (PR4 review P1 #4 拆出 EssayExamResults).
//
// 单题 5 态 dispatch:
//   - isLoading / data undefined → loading skeleton (Pending fallback)
//   - status pending  → EssayGradingPending (real createdAt 起点)
//   - status failed   → EssayGradingFailed + retry button
//   - feedback null   → backend bug 占位
//   - completed       → EssayGradingCard + EssayFeedbackLists + SampleAnswerCard
//
// onRetrySwap 由 ResultsContent 透传 — retry mutation onSuccess 拿 newRecord.id
// 后调它替换 ids URL 中对应位置 (旧 record immutable 不动).

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircleIcon } from '@sikao/ui/icons';
import { Card, EmptyState } from '@sikao/ui/ui';
import { EssayGradingPending } from './EssayGradingPending';
import { EssayGradingFailed } from './EssayGradingFailed';
import { EssayGradingCard } from './EssayGradingCard';
import { EssayFeedbackLists } from './EssayFeedbackLists';
import { SampleAnswerCard } from './SampleAnswerCard';
import { submitEssayGrading } from '@sikao/api-client/apiQueries';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { ESSAY_GRADING_COPY, ERROR_COPY } from '@/lib/ui-copy';
import type { EssayGradingV2 } from '@sikao/api-client/types/api';

export interface ExamResultCardQueryState {
  readonly data: EssayGradingV2 | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export interface ExamResultCardProps {
  readonly recordId: number;
  readonly positionIndex: number;
  readonly queryState: ExamResultCardQueryState;
  readonly onRetrySwap: (newId: number) => void;
}

export function ExamResultCard({
  recordId,
  positionIndex,
  queryState,
  onRetrySwap,
}: ExamResultCardProps) {
  // record 还没拉到时, EssayGradingPending 需要 startedAt. record.createdAt
  // 是真值, 但 isLoading 时拿不到. 用一次性 useState 锁住 mount 时刻 (避免
  // render 内 Date.now() 让 lint react-hooks/purity 报错; 也避免每次 re-render
  // 重置 elapsed 计数).
  const [mountStartedAt] = useState<number>(() => Date.now());

  const retryMutation = useMutation({
    mutationFn: (input: { questionId: number; answerText: string }) =>
      submitEssayGrading(input),
    onSuccess: (newRecord) => {
      onRetrySwap(newRecord.id);
    },
    onError: (err) => {
      logger.error('essay.exam-results.retry_failed', {
        recordId,
        err: String(err),
      });
      toast.error(ESSAY_GRADING_COPY.failedTitle, ERROR_COPY.essayHistory.description);
    },
  });

  const handleRetry = useCallback(() => {
    if (queryState.data === undefined || retryMutation.isPending) return;
    retryMutation.mutate({
      questionId: queryState.data.questionId,
      answerText: queryState.data.answerText,
    });
  }, [queryState.data, retryMutation]);

  if (queryState.isLoading || queryState.data === undefined) {
    return (
      <Card padding="lg" data-testid={`essay-exam-results-loading-${recordId}`}>
        <EssayGradingPending startedAt={mountStartedAt} />
      </Card>
    );
  }

  const record = queryState.data;
  const positionLabel = `第 ${positionIndex + 1} 题`;

  if (record.status === 'pending') {
    const startedAt = Date.parse(record.createdAt);
    return (
      <Card
        padding="lg"
        className="flex flex-col gap-3"
        data-testid={`essay-exam-results-pending-${recordId}`}
      >
        <PositionHeader label={positionLabel} recordId={recordId} />
        <EssayGradingPending startedAt={startedAt} />
      </Card>
    );
  }

  if (record.status === 'failed') {
    return (
      <Card
        padding="lg"
        className="flex flex-col gap-3"
        data-testid={`essay-exam-results-failed-${recordId}`}
      >
        <PositionHeader label={positionLabel} recordId={recordId} />
        <EssayGradingFailed
          failureReason={record.failureReason}
          onRetry={handleRetry}
          isRetrying={retryMutation.isPending}
        />
      </Card>
    );
  }

  // completed. feedback null 是 backend bug, 跟 EssayGradingResult 一致显示占位.
  if (record.feedback === null) {
    return (
      <Card
        padding="lg"
        className="flex flex-col gap-3"
        data-testid={`essay-exam-results-no-feedback-${recordId}`}
      >
        <PositionHeader label={positionLabel} recordId={recordId} />
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={ESSAY_GRADING_COPY.resultDataErrorTitle}
          description={ESSAY_GRADING_COPY.resultDataErrorDesc}
        />
      </Card>
    );
  }

  return (
    <div
      className="flex flex-col gap-4"
      data-testid={`essay-exam-results-completed-${recordId}`}
    >
      <PositionHeader label={positionLabel} recordId={recordId} />
      <EssayGradingCard feedback={record.feedback} />
      <EssayFeedbackLists
        strengths={record.feedback.strengths}
        weaknesses={record.feedback.weaknesses}
        suggestions={record.feedback.suggestions}
      />
      <SampleAnswerCard sampleAnswer={record.feedback.sampleAnswer} />
    </div>
  );
}

// 用户中途弃考 / 网络失败 → recordIds 该位置 null. 占位卡保持题号对齐 (PR2
// review P0 #9), 不让其他卡 idx 漂移. 不做 retry — 用户只能回考场重交整套.
export function SkippedQuestionCard({
  positionIndex,
}: {
  readonly positionIndex: number;
}) {
  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <PositionHeader
        label={`第 ${positionIndex + 1} 题`}
        recordId={null}
      />
      <EmptyState
        icon={<AlertCircleIcon className="w-8 h-8" />}
        title="此题未提交"
        description="弃考 / 答案为空 / 网络失败. 仅展示已提交的题."
      />
    </Card>
  );
}

function PositionHeader({
  label,
  recordId,
}: {
  readonly label: string;
  readonly recordId: number | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-md font-medium text-ink">{label}</h3>
      {recordId !== null ? (
        <span className="text-tiny font-mono tracking-loose text-ink-3">
          record #{recordId}
        </span>
      ) : (
        <span className="text-tiny font-mono tracking-loose text-ink-4">
          未提交
        </span>
      )}
    </div>
  );
}
