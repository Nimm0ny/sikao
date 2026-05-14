import { forwardRef, type ReactNode } from 'react';
import { AlertCircleIcon, InboxIcon, RefreshIcon } from '@sikao/ui/icons';
import { Button, EmptyState } from '@sikao/ui/ui';
import { EMPTY_COPY, ERROR_COPY } from '@/lib/ui-copy';
import type { PaperSummaryV2, PaperUserStatusV2 } from '@sikao/api-client/types/api';
import { PaperListCard } from './PaperListCard';

// PaperListSection — 通用套卷列表区, 学习中心 §3 推荐前 3 / §8 完整题库各自
// 传 heading + caption + headingAction 重用. forwardRef 给完整列表用作 anchor
// (HomeContinueCard secondary CTA "查看全部题库" scrollIntoView).

interface PaperListSectionProps {
  readonly papers: readonly PaperSummaryV2[];
  readonly statusByCode: Record<string, PaperUserStatusV2>;
  readonly isError: boolean;
  readonly onStart: (paper: PaperSummaryV2) => void;
  readonly onRetry: () => void;
  /** Section 标题, 默认"推荐套卷". 学习中心 §3=推荐 / §8=完整题库 各自传值. */
  readonly heading?: string;
  /** 标题下小字, 默认 API 来源说明. 设 null 隐藏. */
  readonly caption?: string | null;
  /** 标题右侧 link/按钮 (如"查看全部 →"). */
  readonly headingAction?: ReactNode;
  /** 给 section 一个稳定 anchor id (滚动定位用). */
  readonly anchorId?: string;
  /**
   * Quiet 模式: papers 空 / isError 时整段不渲染. 学习中心 §3 推荐摘要走
   * quiet=true (无数据就退场, 错误/空态由下方完整 list 兜底), §8 完整列表
   * 走 quiet=false 显式承担 EmptyState / retry.
   */
  readonly quiet?: boolean;
  /** 列表 grid 的 testid, 默认 'paper-list'. 同页多 PaperListSection 区分用. */
  readonly listTestId?: string;
  /** retry 按钮 testid, 默认 'papers-retry'. */
  readonly retryTestId?: string;
}

export const PaperListSection = forwardRef<HTMLElement, PaperListSectionProps>(
  function PaperListSection(
    {
      papers,
      statusByCode,
      isError,
      onStart,
      onRetry,
      heading,
      caption,
      headingAction,
      anchorId,
      quiet,
      listTestId,
      retryTestId,
    },
    ref,
  ) {
    if (quiet === true && (papers.length === 0 || isError)) return null;
    const titleId = anchorId ? `${anchorId}-title` : 'paper-list-title';
    return (
      <section ref={ref} id={anchorId} aria-labelledby={titleId}>
        <header className="flex items-end justify-between mb-4 gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-ink">
              {heading ?? '推荐套卷'}
            </h2>
            {caption !== null ? (
              <p className="text-xs text-ink-3 mt-1">
                {caption ?? (
                  <>
                    来自{' '}
                    <code className="bg-surface-alt px-2 py-1 rounded text-tiny">
                      GET /api/v2/papers
                    </code>{' '}
                    的真实数据
                  </>
                )}
              </p>
            ) : null}
          </div>
          {headingAction !== undefined ? (
            <div className="shrink-0">{headingAction}</div>
          ) : null}
        </header>
        <PaperList
          papers={papers}
          statusByCode={statusByCode}
          isError={isError}
          onStart={onStart}
          onRetry={onRetry}
          listTestId={listTestId ?? 'paper-list'}
          retryTestId={retryTestId ?? 'papers-retry'}
        />
      </section>
    );
  },
);

interface PaperListProps {
  readonly papers: readonly PaperSummaryV2[];
  readonly statusByCode: Record<string, PaperUserStatusV2>;
  readonly isError: boolean;
  readonly onStart: (paper: PaperSummaryV2) => void;
  readonly onRetry: () => void;
  readonly listTestId: string;
  readonly retryTestId: string;
}

// Loading is handled one level up (Home smart container returns
// <HomePageSkeleton /> while useQuery is pending), so this component never
// sees isLoading=true. Phase 4.1 removed the inline spinner branch.
function PaperList({
  papers,
  statusByCode,
  isError,
  onStart,
  onRetry,
  listTestId,
  retryTestId,
}: PaperListProps) {
  if (isError) {
    return (
      <EmptyState
        tone="error"
        icon={<AlertCircleIcon className="w-8 h-8" aria-hidden="true" />}
        title={ERROR_COPY.paperLoad.title}
        description={ERROR_COPY.paperLoad.description}
        action={
          <Button variant="secondary" onClick={onRetry} data-testid={retryTestId}>
            <RefreshIcon className="w-4 h-4 mr-2" aria-hidden="true" />
            重试
          </Button>
        }
      />
    );
  }

  if (papers.length === 0) {
    return (
      <EmptyState
        icon={<InboxIcon className="w-8 h-8" aria-hidden="true" />}
        title={EMPTY_COPY.papers.title}
        description={EMPTY_COPY.papers.description}
      />
    );
  }

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      data-testid={listTestId}
    >
      {papers.map((paper) => (
        <PaperListCard
          key={paper.paperCode}
          paper={paper}
          status={statusByCode[paper.paperCode]}
          onStart={onStart}
        />
      ))}
    </div>
  );
}
