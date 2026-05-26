// lint-allow-ui-copy: V5 ProfileRecords records-foot copy. CJK strings
// are visual contract from `Profile Records v1.html` lines 327-330.
// Nav baseline (4 tabs) untouched — this is a per-page footer.
import styles from './RecordsFoot.module.css';

/*
 * RecordsFoot — timeline footer with "加载更早 ↓" btn.
 *
 * Why: sik-fu-c §2.4 + Acceptance C6 — replaces the previous
 *      `<Pagination>` previous/next button pair with a single
 *      "load earlier" CTA more idiomatic for a chronologically
 *      descending timeline. The button is disabled (and labelled as
 *      such) when no more records are available — AGENT-H7 surfaces
 *      the real state instead of pretending.
 */

export interface RecordsFootProps {
  readonly total: number;
  readonly rangeLabel: string;
  readonly onLoadMore: () => void;
  readonly canLoadMore: boolean;
}

export function RecordsFoot({ total, rangeLabel, onLoadMore, canLoadMore }: RecordsFootProps) {
  const status =
    rangeLabel === ''
      ? `共 ${total} 项`
      : `显示 ${rangeLabel} · 共 ${total} 项`;

  return (
    <footer className={styles.foot} data-testid="profile-records-foot">
      <span className={styles.status}>{status}</span>
      <button
        type="button"
        className={styles.loadMoreBtn}
        onClick={onLoadMore}
        disabled={!canLoadMore}
        title={canLoadMore ? undefined : '已加载全部记录'}
        data-testid="profile-records-load-more"
      >
        {canLoadMore ? '加载更早记录 ↓' : '已加载全部'}
      </button>
    </footer>
  );
}
