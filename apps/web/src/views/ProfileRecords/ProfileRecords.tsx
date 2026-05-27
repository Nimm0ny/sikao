// lint-allow-ui-copy: V5 ProfileRecords page copy. CJK strings are visual
// contract from `Profile Records v1.html`.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfileRecords } from '@sikao/api-client/profileQueries';
import type { ProfileRecordsFilters } from '@sikao/api-client/types/home';
import { PageHeader, ScreenLockShell, ScrollRegion } from '../../components/layout';
import { Skeleton } from '../../components/atom';
import { EmptyState } from '../../components/atom/EmptyState';
import { Button } from '../../components/form';
import { SubNav } from '../Me/SubNav';
import { FilterBar, type RecordKindFilter } from './FilterBar';
import { RecordsWrap } from './RecordsWrap';
import { groupByDay, formatRangeLabel } from './group';
import styles from './ProfileRecords.module.css';

/*
 * ProfileRecords — /profile/records drilldown.
 *
 * Why: sik-fu-c §1 — 4-row grid via ScreenLockShell. Global 4-tab nav
 *      baseline (Rail/BottomTabBar [home, practice, review, note]) is
 *      untouched; SubNav here is the Profile in-page sub-nav (8 pills,
 *      shared with ProfileLearning) and not part of the H12 nav baseline.
 *
 *      Rows:
 *        1. ws-topbar (PageHeader + 导出 placeholder)
 *        2. sub-nav (8 in-page pills, active=records)
 *        3. filter-bar (5 activity-kind seg-pills + date picker placeholder
 *           + 仅看里程碑 placeholder; in-page filter, not navigation)
 *        4. records-wrap (ScrollRegion → DayGroup × N + RecordsFoot)
 *
 *      4-state contract: loading / error / empty / ready. Errors and empty
 *      states keep sub-nav + filter-bar visible per contract §3.
 *
 *      Backend kind values are `xingce_practice` / `essay_submission`
 *      today; the visual filter has 5 pills mapping mock/review/note to
 *      placeholders (disabled until those record kinds land — AGENT-H7
 *      no fake counts).
 */

const PAGE_SIZE = 20;

export function ProfileRecords() {
  const [filters, setFilters] = useState<ProfileRecordsFilters>({
    page: 1,
    size: PAGE_SIZE,
  });
  const [activeKind, setActiveKind] = useState<RecordKindFilter>('all');
  const query = useProfileRecords(filters);

  const handleKindChange = (next: RecordKindFilter, backendKind: string | undefined) => {
    setActiveKind(next);
    setFilters((prev) => ({ ...prev, kind: backendKind, page: 1 }));
  };

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const dayGroups = groupByDay(items);
  const rangeLabel = formatRangeLabel(items);

  return (
    <ScreenLockShell rows="auto auto auto minmax(0, 1fr)" testId="profile-records">
      <PageHeader
        title="学习记录"
        subtitle="按时间倒序查看历次练习、模考、周复盘"
        actions={
          <div className={styles.headerActions}>
            <Button
              variant="ghost"
              size="sm"
              disabled
              aria-label="导出 (占位，待 SIK-FU-N)"
              title="导出 PDF 占位（待 SIK-FU-N）"
            >
              导出
            </Button>
            <Link to="/">
              <Button variant="secondary" size="sm">返回首页</Button>
            </Link>
          </div>
        }
      />
      <SubNav active="records" />
      <FilterBar
        active={activeKind}
        onChange={handleKindChange}
        total={total}
        rangeLabel={rangeLabel}
      />

      <ScrollRegion>
        {query.isLoading ? (
          <div
            className={styles.stateWrap}
            role="status"
            aria-label="学习记录加载中"
            data-testid="profile-records-loading"
          >
            <Skeleton variant="text" lines={6} />
          </div>
        ) : null}

        {query.isError ? (
          <div className={styles.stateWrap} data-testid="profile-records-error">
            <EmptyState
              title="无法加载学习记录"
              description={String((query.error as Error | null)?.message ?? '稍后再试')}
            />
          </div>
        ) : null}

        {query.isSuccess && items.length === 0 ? (
          <div className={styles.stateWrap} data-testid="profile-records-empty">
            <EmptyState
              title="暂无符合条件的记录"
              description="调整筛选条件或返回首页继续练习。"
            />
          </div>
        ) : null}

        {query.isSuccess && items.length > 0 ? (
          <RecordsWrap
            dayGroups={dayGroups}
            total={total}
            rangeLabel={rangeLabel}
            onLoadMore={() => {
              // wave 3: append page+1 results into the timeline. Disabled
              // for now (no infinite-scroll backend signal yet).
            }}
            canLoadMore={items.length < total}
          />
        ) : null}
      </ScrollRegion>
    </ScreenLockShell>
  );
}
