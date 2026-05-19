import { RefreshIcon, SubjectHomeIcon, ToolEyeIcon } from '@sikao/ui/icons';
import { Button } from '@sikao/ui/ui';
import { RESULT_COPY } from '@/lib/ui-copy';
import { ResultIconAction } from './ResultIconAction';

export interface ResultActionsProps {
  readonly onBackHome: () => void;
  readonly onRetry: () => void;
  readonly onViewWrong?: () => void;
  readonly retryDisabled?: boolean;
  readonly viewWrongDisabled?: boolean;
}

export function ResultActions({
  onBackHome,
  onRetry,
  onViewWrong,
  retryDisabled = false,
  viewWrongDisabled = false,
}: ResultActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="result-actions">
      <Button
        variant="primary"
        className="min-w-[160px]"
        leftIcon={<SubjectHomeIcon className="h-4 w-4" />}
        onClick={onBackHome}
        data-testid="result-back-home"
      >
        {RESULT_COPY.status.home}
      </Button>
      <div className="flex items-center gap-2 rounded-card border border-line bg-paper px-3 py-2">
        <span className="text-small font-semibold text-ink">{RESULT_COPY.next.retry}</span>
        <ResultIconAction
          label={RESULT_COPY.next.retry}
          onClick={onRetry}
          disabled={retryDisabled}
          testId="result-retry"
        >
          <RefreshIcon className="h-4 w-4" />
        </ResultIconAction>
      </div>
      {onViewWrong !== undefined ? (
        <div className="flex items-center gap-2 rounded-card border border-line bg-paper px-3 py-2">
          <span className="text-small font-semibold text-ink">{RESULT_COPY.actionsViewWrong}</span>
          <ResultIconAction
            label={RESULT_COPY.actionsViewWrong}
            tooltipLabel={
              viewWrongDisabled
                ? `${RESULT_COPY.actionsNoPaperWarn1}，${RESULT_COPY.actionsNoPaperWarn2}`
                : RESULT_COPY.actionsViewWrong
            }
            onClick={onViewWrong}
            disabled={viewWrongDisabled}
            testId="result-view-wrong"
          >
            <ToolEyeIcon className="h-4 w-4" />
          </ResultIconAction>
        </div>
      ) : null}
    </div>
  );
}
