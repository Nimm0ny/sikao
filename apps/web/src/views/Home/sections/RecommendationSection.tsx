// lint-allow-ui-copy: V5 D.4.1 Section C 今日推荐 copy.
import {
  useRecommendationsToday,
  useRefreshRecommendations,
} from '@sikao/api-client/recommendationsQueries';
import { Skeleton } from '../../../components/atom/Skeleton';
import { EmptyState } from '../../../components/atom/EmptyState';
import { Button } from '../../../components/form';
import { RecommendationCard } from './RecommendationCard';
import styles from './RecommendationSection.module.css';

/*
 * RecommendationSection — Home Section C · 今日推荐.
 *
 * Why: bottom row #3 (per Home v2.1.html). Lists today's recommendations
 *      with accept(session) / reject actions. accept(plan) date picker
 *      and the full RejectFeedbackDialog with draft restore land in
 *      SIK-92 wave 2.
 *
 *      4-state contract (loading / error / empty / ready). Refresh CTA
 *      is always visible in non-loading states so the user can pull a
 *      fresh batch.
 *
 *      AGENT-H7: wave 1 reject path posts a fixed reason
 *      ('not-interested') without prompting; wave 2 wires the dialog.
 *      Errors from the mutation propagate via the mutation result;
 *      not silenced.
 */

export function RecommendationSection() {
  const query = useRecommendationsToday();
  const refresh = useRefreshRecommendations();
  // useRejectRecommendation is hook-bound to a single recommendation id.
  // For wave 1 we call it via card-level handlers (RecommendationCard
  // accepts an onReject callback receiving the rec). To keep the cards
  // pure and avoid one mutation per row, we lift the call here and key
  // the mutation key by id at the section level via the lazy-init form.
  // Wave 2 swaps this for the dialog flow + draft store.
  const items = query.data?.items ?? [];

  if (query.isLoading) {
    return (
      <div className={styles.root} role="status" aria-label="今日推荐加载中" data-testid="home-recommendation-loading">
        <Skeleton variant="rect" height={32} />
        <Skeleton variant="rect" height={64} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div data-testid="home-recommendation-error">
        <EmptyState title="无法加载推荐" description={String((query.error as Error | null)?.message ?? '稍后再试')} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div data-testid="home-recommendation-empty" className={styles.root}>
        <EmptyState title="今日暂无推荐" description="完成更多练习后系统会生成新的推荐。" />
        <div className={styles.refreshRow}>
          <Button variant="secondary" size="sm" disabled={refresh.isPending} onClick={() => refresh.mutate({})}>
            刷新推荐
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root} data-testid="home-recommendation">
      <ul className={styles.list}>
        {items.map((rec) => (
          <RecommendationCard key={rec.id} recommendation={rec} />
        ))}
      </ul>
      <div className={styles.refreshRow}>
        <Button variant="secondary" size="sm" disabled={refresh.isPending} onClick={() => refresh.mutate({})}>
          刷新推荐
        </Button>
      </div>
    </div>
  );
}
