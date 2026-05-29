// lint-allow-ui-copy: SIK-141 aggregation block labels are issue-scoped and
// locked by the visual contract.
import type { PlanEventAggregateReadV2 } from '@sikao/api-client/types/home';

import type { CalendarAggregateQueryState } from '../eventAggregates';
import { formatActiveSeconds, peekAggregateEmptyLabel } from '../eventAggregates';
import styles from './CalendarPeekCard.module.css';

export interface CalendarPeekAggregationProps {
  readonly aggregate?: PlanEventAggregateReadV2;
  readonly aggregateState: Pick<CalendarAggregateQueryState, 'isLoaded' | 'isError'>;
}

export function CalendarPeekAggregation({
  aggregate,
  aggregateState,
}: CalendarPeekAggregationProps) {
  const label = peekAggregateEmptyLabel(aggregate, aggregateState);
  if (label !== null) {
    return (
      <section className={styles.aggregationSection} data-testid="home-calendar-peek-aggregation">
        <h3 className={styles.notesHead}>聚合</h3>
        <p className={styles.aggregationEmpty} data-testid="home-calendar-peek-aggregation-empty">
          {label}
        </p>
      </section>
    );
  }
  if (!aggregateState.isLoaded || aggregate === undefined || aggregate.metrics === null) return null;

  const activeMinutes = formatActiveSeconds(aggregate.metrics.activeSeconds);

  return (
    <section className={styles.aggregationSection} data-testid="home-calendar-peek-aggregation">
      <h3 className={styles.notesHead}>聚合</h3>
      <div className={styles.aggregationGrid}>
        <div className={styles.aggregationCell}>
          <span className={styles.aggregationLabel}>练习量</span>
          <span className={styles.aggregationValue}>{aggregate.metrics.attemptedCount}</span>
        </div>
        <div className={styles.aggregationCell}>
          <span className={styles.aggregationLabel}>正确数</span>
          <span className={styles.aggregationValue}>{aggregate.metrics.correctCount}</span>
        </div>
        <div className={styles.aggregationCell}>
          <span className={styles.aggregationLabel}>正确率</span>
          <span className={styles.aggregationValue}>{Math.round(aggregate.metrics.accuracy * 1000) / 10}%</span>
        </div>
        {activeMinutes !== null ? (
          <div className={styles.aggregationCell}>
            <span className={styles.aggregationLabel}>用时</span>
            <span className={styles.aggregationValue}>{activeMinutes}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
