import { Button, EmptyState } from '@sikao/ui/ui';
import { WrongQuestionCard } from './WrongQuestionCard';
import type { WrongQuestionDetailV2 } from '@sikao/api-client/types/api';

// Phase 5.4e — 中栏列表 + 分页控件。

export interface WrongQuestionListProps {
  readonly items: readonly WrongQuestionDetailV2[];
  readonly selectedId: number | null;
  readonly onSelect: (questionId: number) => void;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (next: number) => void;
  // Phase 6.4 P2 batch retry. 由 smart container 持有 set + handler.
  readonly batchSelected?: ReadonlySet<number>;
  readonly onToggleBatch?: (questionId: number) => void;
  readonly onBatchRetry?: () => void;
  readonly batchRetryDisabled?: boolean;
  readonly batchRetryDisabledReason?: string;
  /** PR10: "问 AI" callback, 透传 WrongQuestionCard. */
  readonly onAsk?: (questionId: number) => void;
}

export function WrongQuestionList({
  items,
  selectedId,
  onSelect,
  total,
  page,
  pageSize,
  onPageChange,
  batchSelected,
  onToggleBatch,
  onBatchRetry,
  batchRetryDisabled,
  batchRetryDisabledReason,
  onAsk,
}: WrongQuestionListProps) {
  if (items.length === 0 && total === 0) {
    return (
      <EmptyState
        title="没有错题"
        description="完成练习后，做错的题会出现在这里。"
      />
    );
  }
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const isBatchRetryDisabled = batchSelected?.size === 0 || batchRetryDisabled === true;
  const batchRetryAriaLabel = batchRetryDisabledReason !== undefined
    ? `批量重做：${batchRetryDisabledReason}`
    : '批量重做';
  return (
    <main className="flex flex-col gap-3" data-testid="wrong-question-list">
      <div className="text-xs text-ink-3 flex items-center gap-2">
        <span>
          共 <b className="text-ink font-serif italic">{total}</b> 题
        </span>
        <span>·</span>
        <span>
          第 {page} / {maxPage} 页
        </span>
      </div>
      {/* Phase 6.4 P2 batch retry toolbar. 0 选时 button disable. */}
      {onBatchRetry !== undefined && batchSelected !== undefined ? (
        <div
          className="flex items-center gap-3 py-2 px-3 bg-surface-alt border border-line rounded-card"
          data-testid="wrong-batch-toolbar"
        >
          <span className="text-xs text-ink-3">
            已选 <b className="text-ink tabular-nums">{batchSelected.size}</b> 题
          </span>
          {batchRetryDisabledReason !== undefined ? (
            <span
              className="text-xs text-err"
              data-testid="wrong-batch-retry-hint"
            >
              {batchRetryDisabledReason}
            </span>
          ) : null}
          <span className="ml-auto" />
          <Button
            variant="primary"
            size="sm"
            disabled={isBatchRetryDisabled}
            onClick={onBatchRetry}
            data-testid="wrong-batch-retry"
            aria-label={batchRetryAriaLabel}
          >
            批量重做 →
          </Button>
        </div>
      ) : null}
      <div className="space-y-3">
        {items.map((item) => (
          <WrongQuestionCard
            key={item.questionId}
            item={item}
            selected={selectedId === item.questionId}
            onSelect={onSelect}
            batch={
              onToggleBatch !== undefined
                ? {
                    inBatch: batchSelected?.has(item.questionId) ?? false,
                    onToggleBatch,
                  }
                : undefined
            }
            onAsk={onAsk}
          />
        ))}
      </div>
      {maxPage > 1 ? (
        <nav
          className="flex items-center justify-center gap-3 pt-2 border-t border-line"
          aria-label="分页"
        >
          <Button
            variant="quiet"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            data-testid="wrong-book-prev-page"
          >
            <span className="font-serif italic">←</span>
            <span>上一页</span>
          </Button>
          <span className="text-sm tabular-nums text-ink-3">
            {page} / {maxPage}
          </span>
          <Button
            variant="quiet"
            disabled={page >= maxPage}
            onClick={() => onPageChange(page + 1)}
            data-testid="wrong-book-next-page"
          >
            <span>下一页</span>
            <span className="font-serif italic">→</span>
          </Button>
        </nav>
      ) : null}
    </main>
  );
}
