// lint-allow-ui-copy: V5 ProfileRecords records-wrap copy. CJK strings
// are visual contract from `Profile Records v1.html`.
// Nav baseline (4 tabs) untouched — this is a per-page wrap container.
import type { DayGroup as DayGroupModel } from './group';
import { DayGroup } from './DayGroup';
import { RecordsFoot } from './RecordsFoot';
import styles from './RecordsWrap.module.css';

/*
 * RecordsWrap — paper card around the timeline body + footer.
 *
 * Why: sik-fu-c §2.3 — body holds N day-groups; foot pinned to bottom
 *      with `加载更早 ↓` btn (replacing Pagination per §5 drift). Body
 *      has no internal overflow because the parent ScrollRegion already
 *      owns scroll; we just stack groups vertically.
 */

export interface RecordsWrapProps {
  readonly dayGroups: ReadonlyArray<DayGroupModel>;
  readonly total: number;
  readonly rangeLabel: string;
  readonly onLoadMore: () => void;
  readonly canLoadMore: boolean;
}

export function RecordsWrap({
  dayGroups,
  total,
  rangeLabel,
  onLoadMore,
  canLoadMore,
}: RecordsWrapProps) {
  return (
    <article className={styles.wrap} data-testid="profile-records-wrap">
      <div className={styles.body} data-testid="profile-records-body">
        {dayGroups.map((group) => (
          <DayGroup key={group.stamp} group={group} />
        ))}
      </div>
      <RecordsFoot
        total={total}
        rangeLabel={rangeLabel}
        onLoadMore={onLoadMore}
        canLoadMore={canLoadMore}
      />
    </article>
  );
}
