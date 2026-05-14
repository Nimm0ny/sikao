import { useEffect } from 'react';
import { AlertCircleIcon } from '@sikao/ui/icons';
import { Button, EmptyState } from '@sikao/ui/ui';
import { logger } from '@sikao/shared-utils';
import { ESSAY_GRADING_COPY } from '@/lib/ui-copy';

// Slice 2d — failed 批改态 (dumb).
//
// failureReason 是 backend essay_grading.py 写入的技术错误码, 不在用户界面直出.
// 但必须 emit 到 logger 给 ops triage (post-2026-05-11 audit P2): 否则 ops 失去
// 技术错误码信号 — 用户重试若再失败, ops 无法对照后端 grading worker 日志定位.
// 重新提交走新 record (record immutable, plan §3 D5).

export interface EssayGradingFailedProps {
  readonly failureReason: string | null;
  readonly onRetry: () => void;
  readonly isRetrying?: boolean;
  readonly className?: string;
}

export function EssayGradingFailed({
  failureReason,
  onRetry,
  isRetrying = false,
  className,
}: EssayGradingFailedProps) {
  useEffect(() => {
    if (failureReason !== null && failureReason !== '') {
      logger.error('essay.grading.failed', { failureReason });
    }
  }, [failureReason]);

  return (
    <EmptyState
      tone="error"
      icon={<AlertCircleIcon className="w-8 h-8" />}
      title={ESSAY_GRADING_COPY.failedTitle}
      description={ESSAY_GRADING_COPY.failedDesc}
      action={
        <Button
          variant="primary"
          onClick={onRetry}
          disabled={isRetrying}
          data-testid="essay-grading-failed-retry"
        >
          {isRetrying
            ? ESSAY_GRADING_COPY.submitting
            : ESSAY_GRADING_COPY.retrySubmit}
        </Button>
      }
      className={className}
    />
  );
}
