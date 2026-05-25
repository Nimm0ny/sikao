// lint-allow-ui-copy: V5 ProfileRecords page copy.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfileRecords } from '@sikao/api-client/profileQueries';
import type { ProfileRecordsFilters } from '@sikao/api-client/types/home';
import { PageHeader, Panel } from '../../components/layout';
import { Skeleton, Badge } from '../../components/atom';
import { EmptyState } from '../../components/atom/EmptyState';
import { Pagination } from '../../components/nav/Pagination';
import { Button } from '../../components/form';
import styles from './ProfileRecords.module.css';

/*
 * ProfileRecords — /profile/records drilldown.
 *
 * Why: paged list of the user's learning records (xingce / shenlun /
 *      mock-exam / weekly-review). Filter by `kind` and date range,
 *      paginate via the V5 Pagination primitive. Each row is a Link
 *      to `record.href` (contract: backend always returns absolute
 *      relative paths the frontend can navigate to).
 *
 *      4-state contract reflected from useProfileRecords; H7 fail-fast
 *      on filter parse (date range invalid → ignored, not coerced).
 */

const PAGE_SIZE = 20;
const KINDS = ['', 'xingce', 'shenlun', 'mock-exam', 'weekly-review'] as const;
const KIND_LABEL: Record<string, string> = {
  '': '全部',
  'xingce': '行测',
  'shenlun': '申论',
  'mock-exam': '模考',
  'weekly-review': '周复盘',
};

function FilterBar({ filters, onChange }: {
  readonly filters: ProfileRecordsFilters;
  readonly onChange: (next: ProfileRecordsFilters) => void;
}) {
  return (
    <div className={styles.filterBar} data-testid="profile-records-filter">
      <label className={styles.filterField} htmlFor="profile-records-kind">
        <span>类型</span>
        <select
          id="profile-records-kind"
          aria-label="筛选记录类型"
          value={filters.kind ?? ''}
          onChange={(e) => onChange({ ...filters, kind: e.target.value || undefined, page: 1 })}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>
          ))}
        </select>
      </label>
      <label className={styles.filterField} htmlFor="profile-records-from">
        <span>从</span>
        <input
          id="profile-records-from"
          aria-label="开始日期"
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => onChange({ ...filters, from: e.target.value || undefined, page: 1 })}
        />
      </label>
      <label className={styles.filterField} htmlFor="profile-records-to">
        <span>到</span>
        <input
          id="profile-records-to"
          aria-label="结束日期"
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => onChange({ ...filters, to: e.target.value || undefined, page: 1 })}
        />
      </label>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange({ page: 1, size: PAGE_SIZE })}
      >
        重置
      </Button>
    </div>
  );
}

export function ProfileRecords() {
  const [filters, setFilters] = useState<ProfileRecordsFilters>({ page: 1, size: PAGE_SIZE });
  const query = useProfileRecords(filters);

  return (
    <div className={styles.root} data-testid="profile-records">
      <PageHeader
        title="学习记录"
        subtitle="按时间倒序查看历次练习、模考、周复盘"
        actions={
          <Link to="/">
            <Button variant="secondary" size="sm">返回首页</Button>
          </Link>
        }
      />
      <FilterBar filters={filters} onChange={setFilters} />
      {query.isLoading ? (
        <Panel title="记录列表">
          <div className={styles.stateWrap} role="status" aria-label="学习记录加载中" data-testid="profile-records-loading">
            <Skeleton variant="text" lines={6} />
          </div>
        </Panel>
      ) : null}
      {query.isError ? (
        <Panel title="记录列表" variant="danger">
          <div className={styles.stateWrap} data-testid="profile-records-error">
            <EmptyState title="无法加载学习记录" description={String((query.error as Error | null)?.message ?? '稍后再试')} />
          </div>
        </Panel>
      ) : null}
      {query.isSuccess && (query.data?.items.length ?? 0) === 0 ? (
        <Panel title="记录列表">
          <div className={styles.stateWrap} data-testid="profile-records-empty">
            <EmptyState title="暂无符合条件的记录" description="调整筛选条件或返回首页继续练习。" />
          </div>
        </Panel>
      ) : null}
      {query.isSuccess && (query.data?.items.length ?? 0) > 0 ? (
        <Panel title="记录列表" noPadding>
          <ul className={styles.list}>
            {query.data!.items.map((rec) => (
              <li key={rec.id}>
                <Link to={rec.href} className={styles.row} data-testid={`profile-records-row-${rec.id}`}>
                  <Badge size="sm" variant="cat-yanyu">{KIND_LABEL[rec.kind] ?? rec.kind}</Badge>
                  <span className={styles.title}>{rec.title}</span>
                  <span className={styles.meta}>{rec.occurredAt.slice(0, 10)}</span>
                  <span className={styles.score}>{rec.score ?? '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.paginationRow}>
            <Pagination
              current={filters.page ?? 1}
              total={query.data?.total ?? 0}
              pageSize={PAGE_SIZE}
              onChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
