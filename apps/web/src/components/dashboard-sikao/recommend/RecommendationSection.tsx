import { EmptyState, Button, Card, Skeleton } from '@sikao/ui/ui';
import {
  useRecommendationsToday,
  useRefreshRecommendations,
} from '@sikao/api-client/recommendationsQueries';

import { EmptyRecommendation } from './EmptyRecommendation';
import { RecommendationCard } from './RecommendationCard';
import { asRecommendationActionType } from './recommendRuntime';

export function RecommendationSection() {
  const recommendationsQuery = useRecommendationsToday();
  const refreshMutation = useRefreshRecommendations();
  const refreshError = refreshMutation.isError
    ? refreshMutation.error instanceof Error
      ? refreshMutation.error.message
      : String(refreshMutation.error)
    : null;

  if (recommendationsQuery.isLoading) {
    return (
      <section className="space-y-4" data-testid="dashboard-recommendation-section">
        <Card padding="md" className="border-line bg-surface">
          <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
            Section C
          </div>
          <div className="mt-1 font-serif text-2xl text-ink">今日推荐</div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Skeleton heightClass="h-64" />
            <Skeleton heightClass="h-64" />
          </div>
        </Card>
      </section>
    );
  }

  if (recommendationsQuery.isError) {
    return (
      <section data-testid="dashboard-recommendation-section">
        <EmptyState
          tone="error"
          title="Section C 加载失败"
          description="当前 recommendations/today 不可用，请重试。"
          action={
            <Button variant="secondary" onClick={() => void recommendationsQuery.refetch()}>
              重试
            </Button>
          }
        />
      </section>
    );
  }

  const items = recommendationsQuery.data?.items ?? [];
  try {
    items.forEach((item) => {
      asRecommendationActionType(item.actionType);
    });
  } catch (error) {
    return (
      <section data-testid="dashboard-recommendation-section">
        <EmptyState
          tone="error"
          title="Section C 数据异常"
          description={error instanceof Error ? error.message : 'Unsupported recommendation action type'}
          action={
            <Button variant="secondary" onClick={() => void recommendationsQuery.refetch()}>
              重试
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-4" data-testid="dashboard-recommendation-section">
      <Card padding="md" className="border-line bg-surface">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
              Section C
            </div>
            <div className="mt-1 font-serif text-2xl text-ink">今日推荐</div>
            <div className="mt-2 text-sm text-ink-3">
              基于实时实绩和目标状态生成的 2-3 张推荐卡。
            </div>
          </div>
          <Button
            variant="secondary"
            isLoading={refreshMutation.isPending}
            onClick={() =>
              refreshMutation.mutate({
                payload: { trigger: 'dashboard-manual-refresh' },
              })
            }
          >
            换一批
          </Button>
        </div>

        <div className="mt-4">
          {refreshError ? (
            <div className="mb-4 rounded-card border border-err bg-err-bg p-3 text-sm text-err">
              刷新今日推荐失败：{refreshError}
            </div>
          ) : null}
          {items.length === 0 ? (
            <EmptyRecommendation />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {items.map((item) => (
                <RecommendationCard key={item.id} recommendation={item} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
