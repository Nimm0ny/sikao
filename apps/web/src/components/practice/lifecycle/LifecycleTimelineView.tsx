import { Banner } from '../../overlay';
import { EmptyState, Skeleton } from '../../atom';
import type { SessionLifecycleResponseV2 } from '@sikao/api-client/types/practice';
import styles from './LifecycleTimelineView.module.css';

export interface LifecycleTimelineViewProps {
  readonly lifecycle?: SessionLifecycleResponseV2;
  readonly loading?: boolean;
  readonly error?: boolean;
}

export function LifecycleTimelineView({
  lifecycle,
  loading = false,
  error = false,
}: LifecycleTimelineViewProps) {
  if (loading) {
    return <Skeleton variant="text" lines={6} />;
  }

  if (error) {
    return (
      <Banner
        variant="err"
        title="Lifecycle load failed"
        description="Lifecycle transitions are unavailable right now."
      />
    );
  }

  if (!lifecycle) {
    return (
      <EmptyState
        title="No lifecycle data"
        description="Lifecycle details will appear after state transitions occur."
      />
    );
  }

  return (
    <div data-testid="lifecycle-timeline">
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Status</span>
          <span className={styles.summaryValue}>{lifecycle.status}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Paused count</span>
          <span className={styles.summaryValue}>{lifecycle.pausedCount}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Paused seconds</span>
          <span className={styles.summaryValue}>{lifecycle.pausedTotalSeconds}</span>
        </div>
      </div>
      {lifecycle.transitions && lifecycle.transitions.length > 0 ? (
        <ol className={styles.timeline} aria-label="Lifecycle transitions">
          {lifecycle.transitions.map((transition, index) => (
            <li key={`${transition.trigger}-${transition.ts}-${index}`} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.itemTitle}>
                  {transition.fromStatus} {'->'} {transition.toStatus}
                </span>
                <span className={styles.itemMeta}>
                  {transition.trigger} / {transition.actor}
                </span>
              </div>
              <div className={styles.itemMeta}>{new Date(transition.ts).toLocaleString()}</div>
              {transition.reason ? (
                <p className={styles.itemReason}>{transition.reason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No lifecycle transitions"
          description="This session has not recorded any lifecycle transitions yet."
        />
      )}
    </div>
  );
}
