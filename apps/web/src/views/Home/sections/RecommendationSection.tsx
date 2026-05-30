// lint-allow-ui-copy: V5 D.4.1 Section C 今日推荐 copy.
import {
  useRecommendationsToday,
  useRefreshRecommendations,
} from '@sikao/api-client/recommendationsQueries';
import { Skeleton } from '../../../components/atom/Skeleton';
import { EmptyState } from '../../../components/atom/EmptyState';
import { RecommendationCard } from './RecommendationCard';
import styles from './RecommendationSection.module.css';

/*
 * RecommendationSection — Home Section C · 今日推荐.
 *
 * Why: bottom row card (per Home v2.1.html .bottom-card / .feed-list).
 *      Lists today's recommendations with accept(session) / reject
 *      actions via RecommendationCard. accept(plan) date picker and the
 *      full RejectFeedbackDialog live under RecommendationCard.
 *
 *      SIK-143: the card no longer sits inside a <Panel> 57px header.
 *      It owns its own bc-head (h4 "今日推荐" + refresh icon-btn) shared
 *      across all 4 states, matching the right-stack cards' bc-head spec.
 *      The refresh control moved from a floating bottom Button into the
 *      bc-head as an icon-only button (aria-label "刷新推荐"). The list is
 *      a local-scroll region (min-height:0 + overflow-y:auto) so a long
 *      batch scrolls inside the card instead of overflowing the row.
 *
 *      4-state contract (loading / error / empty / ready). AGENT-H7:
 *      mutation errors propagate via the mutation result; not silenced.
 */

// Visible feed cap before the list switches to scroll + bottom-fade.
// 3 full rows show; a 4th+ row peeks ~20% under the fade as a "more below" cue.
const RECOMMENDATION_VISIBLE_ITEMS = 3;

export function RecommendationSection() {
  const query = useRecommendationsToday();
  const refresh = useRefreshRecommendations();
  const items = query.data?.items ?? [];

  const head = (
    <header className={styles.head}>
      <h4 className={styles.title}>今日推荐</h4>
      <button
        type="button"
        className={styles.refreshBtn}
        aria-label="刷新推荐"
        disabled={query.isLoading || refresh.isPending}
        onClick={() => refresh.mutate({})}
      >
        {/* inline SVG: sprite has no refresh glyph; follows SVG-only stroke
            contract (viewBox 24 / fill none / currentColor / round caps). */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 9-9" />
          <path d="M3 4v5h5" />
        </svg>
      </button>
    </header>
  );

  if (query.isLoading) {
    return (
      <div className={styles.root} role="status" aria-label="今日推荐加载中" data-testid="home-recommendation-loading">
        {head}
        <Skeleton variant="rect" height={32} />
        <Skeleton variant="rect" height={64} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={styles.root} data-testid="home-recommendation-error">
        {head}
        <EmptyState title="无法加载推荐" description={String((query.error as Error | null)?.message ?? '稍后再试')} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={styles.root} data-testid="home-recommendation-empty">
        {head}
        <EmptyState title="今日暂无推荐" description="完成更多练习后系统会生成新的推荐。" />
      </div>
    );
  }

  return (
    <div className={styles.root} data-testid="home-recommendation">
      {head}
      <ul
        className={styles.list}
        data-scrollable={items.length > RECOMMENDATION_VISIBLE_ITEMS || undefined}
      >
        {items.map((rec) => (
          <RecommendationCard key={rec.id} recommendation={rec} />
        ))}
      </ul>
    </div>
  );
}
