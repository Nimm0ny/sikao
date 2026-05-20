/**
 *
 * 接 Y2-BE d14b0ab 2 endpoint (filters + list/extended):
 *   - GET /papers/essay/filters         → FiltersPanel chip 候选 (regions/years/paperTypes)
 *   - GET /papers/essay/list/extended   → PaperRow list (扩字段 region/track/difficulty/
 *     status/progress/lastAttempt/pinned) + paginate
 *
 * URL state:
 *   - ?region= / ?year= / ?paperType= / ?page=  (无值 → fallback)
 *   - 切 filter → page reset 到 1 (跨筛选 page 索引无意义)
 *   - 单页 (totalPages=1) 不渲染 pager
 *
 */
import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Pagination, Skeleton, EmptyState } from '@sikao/ui/ui';
import { QueryBoundary } from '@/components/data';
import { InboxIcon } from '@sikao/ui/icons';
import {
  FiltersPanel,
  PaperRow,
  type FiltersValue,
} from '@/components/essay/papers';
import {
  useEssayPapersFilters,
  useEssayPapersListExtended,
  type EssayPaperListItemV2Extended,
  type EssayPapersExtendedFilters,
  type EssayPapersFiltersResponseV2,
  type EssayPapersListExtendedResponseV2,
} from '@sikao/api-client/queries/essaySpecialtyQueries';
import { EMPTY_COPY, ERROR_COPY } from '@/lib/ui-copy';

const PAGE_SIZE = 20;
const DEFAULT_SORT: EssayPapersExtendedFilters['sort'] = 'default';

function parsePage(raw: string | null): number {
  const n = raw !== null ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseYear(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1900 && n <= 2100 ? n : null;
}

export default function EssayPapers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL → state. 不命中规则的入参直接 fallback (FE 兜底, 不向 BE 发非法值).
  const region = searchParams.get('region') ?? '';
  const paperType = searchParams.get('paperType') ?? '';
  const year = parseYear(searchParams.get('year'));
  const page = parsePage(searchParams.get('page'));

  const value: FiltersValue = useMemo(
    () => ({ region, year, paperType }),
    [region, year, paperType],
  );

  const queryFilters = useMemo<EssayPapersExtendedFilters>(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      region: region === '' ? undefined : region,
      year: year ?? undefined,
      paperType: paperType === '' ? undefined : paperType,
      sort: DEFAULT_SORT,
    }),
    [page, region, year, paperType],
  );

  const filtersQ = useEssayPapersFilters();
  const listQ = useEssayPapersListExtended(queryFilters);

  const writeUrl = useCallback(
    (next: FiltersValue, nextPage: number): void => {
      const params: Record<string, string> = {};
      if (next.region !== '') params.region = next.region;
      if (next.year !== null) params.year = String(next.year);
      if (next.paperType !== '') params.paperType = next.paperType;
      if (nextPage > 1) params.page = String(nextPage);
      setSearchParams(params);
    },
    [setSearchParams],
  );

  const handleFiltersChange = useCallback(
    (next: FiltersValue): void => {
      writeUrl(next, 1);
    },
    [writeUrl],
  );

  const handleReset = useCallback((): void => {
    writeUrl({ region: '', year: null, paperType: '' }, 1);
  }, [writeUrl]);

  const handlePage = useCallback(
    (nextPage: number): void => {
      writeUrl(value, nextPage);
    },
    [value, writeUrl],
  );

  const handleStart = useCallback(
    (paper: EssayPaperListItemV2Extended): void => {
      navigate(`/essay/papers/${paper.paperCode}`);
    },
    [navigate],
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow="04 · Essay / Papers"
        title={
          <>
            申论 · 套卷练习
            <span className="text-ink-3"> · </span>
            <span className="font-serif font-medium">挑一卷 选一题 落笔</span>
          </>
        }
        subtitle="按地区或年份筛选定向冲刺. 写完提交后获得 5 维度评分和示范答案 — 记录会自动落到「我的申论」."
      />

      <QueryBoundary
        query={filtersQ}
        testId="essay-papers-filters-q"
        skeleton={<Skeleton heightClass="h-44" />}
        errorTitle={ERROR_COPY.paperLoad.title}
        errorDescription={ERROR_COPY.paperLoad.description}
      >
        {(filters: EssayPapersFiltersResponseV2) => (
          <FiltersPanel
            filters={filters}
            value={value}
            totalCount={listQ.data?.total ?? 0}
            onChange={handleFiltersChange}
            onReset={handleReset}
          />
        )}
      </QueryBoundary>

      <QueryBoundary
        query={listQ}
        testId="essay-papers"
        skeleton={
          <div className="bg-paper border border-line rounded-card overflow-hidden">
            <Skeleton heightClass="h-20" />
            <Skeleton heightClass="h-20" />
            <Skeleton heightClass="h-20" />
            <Skeleton heightClass="h-20" />
            <Skeleton heightClass="h-20" />
          </div>
        }
        errorTitle={ERROR_COPY.paperLoad.title}
        errorDescription={ERROR_COPY.paperLoad.description}
        emptyWhen={(data) => data.items.length === 0}
        emptyState={
          <EmptyState
            icon={<InboxIcon className="w-8 h-8" />}
            title={EMPTY_COPY.papers.title}
            description="切换筛选条件试试, 或重置筛选."
          />
        }
      >
        {(data: EssayPapersListExtendedResponseV2) => (
          <ListBody data={data} onStart={handleStart} onPage={handlePage} />
        )}
      </QueryBoundary>
    </div>
  );
}

interface ListBodyProps {
  readonly data: EssayPapersListExtendedResponseV2;
  readonly onStart: (paper: EssayPaperListItemV2Extended) => void;
  readonly onPage: (next: number) => void;
}

function ListBody({ data, onStart, onPage }: ListBodyProps) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const rangeStart = (data.page - 1) * data.pageSize + 1;
  const rangeEnd = Math.min(data.page * data.pageSize, data.total);
  return (
    <div className="space-y-5" data-testid="essay-papers-wrap">
      <div className="flex items-baseline justify-between px-1">
        <div className="font-mono text-tiny tracking-widest uppercase text-ink-3">
          共{' '}
          <strong className="font-serif text-base font-semibold text-ink tracking-tight normal-case mx-1">
            {data.total}
          </strong>{' '}
          套 · 显示{' '}
          <strong className="font-serif text-base font-semibold text-ink tracking-tight normal-case mx-1">
            {rangeStart}
          </strong>
          –
          <strong className="font-serif text-base font-semibold text-ink tracking-tight normal-case mx-1">
            {rangeEnd}
          </strong>
        </div>
      </div>
      <div
        className="bg-paper border border-line rounded-card overflow-hidden"
        data-testid="essay-papers-list"
      >
        {data.items.map((paper) => (
          <PaperRow key={paper.paperCode} paper={paper} onClick={onStart} />
        ))}
      </div>
      {totalPages > 1 ? (
        <Pagination
          page={data.page}
          totalPages={totalPages}
          onChange={onPage}
          testIdPrefix="essay-papers"
          ariaLabel="申论真题分页"
        />
      ) : null}
    </div>
  );
}
