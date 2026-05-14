import { Button, Tooltip } from '@sikao/ui/ui';

// Bottom action bar for the result page. Mirrors docs/ui-demo/ui-preview.html
// §497-500: 返回首页 (ink, primary CTA) + 再练一遍 (ghost). Kept dumb — the
// smart container wires the navigation callbacks (no Link / useNavigate
// inside this component, per CLAUDE.md §2.2).
//
// P0-1: 看本套错题 button 跳 /wrong-book?paperCode=XXX. paperCode 缺时
// (retry session / cross-paper) disable + 提示 reason.

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
    <div className="flex flex-wrap gap-3" data-testid="result-actions">
      <Button
        variant="primary"
        className="flex-1 min-w-[140px]"
        onClick={onBackHome}
        data-testid="result-back-home"
      >
        返回首页
      </Button>
      {/* secondary variant: ink 边 + ink 字，比 ghost 更强，element spec。 */}
      <Button
        variant="secondary"
        className="flex-1 min-w-[140px]"
        onClick={onRetry}
        disabled={retryDisabled}
        data-testid="result-retry"
      >
        再练一遍
      </Button>
      {onViewWrong !== undefined ? (
        <Tooltip
          label={
            viewWrongDisabled
              ? '本场没有试卷编号，无法定位本套错题'
              : '看本套错题'
          }
        >
          <Button
            variant="quiet"
            className="flex-1 min-w-[140px]"
            onClick={onViewWrong}
            disabled={viewWrongDisabled}
            data-testid="result-view-wrong"
            aria-label="看本套错题"
          >
            看本套错题
            <span className="font-serif italic ml-1" aria-hidden="true">→</span>
          </Button>
        </Tooltip>
      ) : null}
    </div>
  );
}
