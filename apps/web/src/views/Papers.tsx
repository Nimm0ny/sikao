/**
 *
 * 接 Xa-BE 7a06b94 2 endpoint (mirror EssayPapers):
 *   - GET /papers/xingce/filters         → FiltersPanel chip 候选 (regions/years/paperTypes)
 *   - GET /papers/xingce/list/extended   → PaperRow list (扩字段 region/track/difficulty/
 *     status/progress/lastAttempt/pinned) + paginate
 *
 * URL state:
 *   - ?region= / ?year= / ?paperType= / ?page=  (无值 → fallback)
 *   - 切 filter → page reset 到 1 (跨筛选 page 索引无意义)
 *   - 单页 (totalPages=1) 不渲染 pager
 *
 *   - FiltersPanel 3 行 chip (地区 / 卷型 / 年份) + 重置入口
 *   - PaperRow 5 列 grid (yr/title+tags/stat+difficulty/status+lastAttempt/cta)
 *   - Pagination atom (server-side pagination, 不再 client-side filter 762)
 *
 * 视觉子组件复用 essay/papers (mode='xingce'), 详 fixer 报告策略.
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
  type AnyPaperRow,
} from '@/components/essay/papers';
import {
  useXingcePapersFilters,
  useXingcePapersListExtended,
  type XingcePapersExtendedFilters,
  type XingcePapersFiltersResponseV2,
  type XingcePapersListExtendedResponseV2,
} from '@sikao/api-client/queries/xingceSpecialtyQueries';
import { EMPTY_COPY, ERROR_COPY } from '@/lib/ui-copy';

const PAGE_SIZE = 20;
const DEFAULT_SORT: XingcePapersExtendedFilters['sort'] = 'default';

function parsePage(raw: string | null): number {
  const n = raw !== null ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseYear(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1900 && n <= 2100 ? n : null;
}

export default function Papers() {
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

  const queryFilters = useMemo<XingcePapersExtendedFilters>(
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

  const filtersQ = useXingcePapersFilters();
  const listQ = useXingcePapersListExtended(queryFilters);

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
    (paper: AnyPaperRow): void => {
      navigate(`/practice/${paper.paperCode}/start`);
    },
    [navigate],
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6" data-testid="papers-view">
      <PageHeader
        eyebrow="03 · Xingce / Papers"
        title={
          <>
            行测 · 套卷题库
            <span className="text-ink-3"> · </span>
            <span className="font-serif font-medium">挑一卷 开练</span>
          </>
        }
        subtitle="按地区或年份筛选定向冲刺. 提交后查看正确率、错题归类、答题用时 — 记录会自动落到「我的练习」."
      />

      <QueryBoundary
        query={filtersQ}
        testId="xingce-papers-filters-q"
        skeleton={<Skeleton heightClass="h-44" />}
        errorTitle={ERROR_COPY.paperLoad.title}
        errorDescription={ERROR_COPY.paperLoad.description}
      >
        {(filters: XingcePapersFiltersResponseV2) => (
          <FiltersPanel
            filters={filters}
            value={value}
            totalCount={listQ.data?.total ?? 0}
            mode="xingce"
            onChange={handleFiltersChange}
            onReset={handleReset}
          />
        )}
      </QueryBoundary>

      <QueryBoundary
        query={listQ}
        testId="xingce-papers"
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
        {(data: XingcePapersListExtendedResponseV2) => (
          <ListBody data={data} onStart={handleStart} onPage={handlePage} />
        )}
      </QueryBoundary>
    </div>
  );
}

interface ListBodyProps {
  readonly data: XingcePapersListExtendedResponseV2;
  readonly onStart: (paper: AnyPaperRow) => void;
  readonly onPage: (next: number) => void;
}

function ListBody({ data, onStart, onPage }: ListBodyProps) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const rangeStart = (data.page - 1) * data.pageSize + 1;
  const rangeEnd = Math.min(data.page * data.pageSize, data.total);
  return (
    <div className="space-y-5" data-testid="xingce-papers-wrap">
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
        data-testid="xingce-papers-list"
      >
        {data.items.map((paper) => (
          <PaperRow
            key={paper.paperCode}
            paper={paper}
            mode="xingce"
            onClick={onStart}
          />
        ))}
      </div>
      {totalPages > 1 ? (
        <Pagination
          page={data.page}
          totalPages={totalPages}
          onChange={onPage}
          testIdPrefix="xingce-papers"
          ariaLabel="行测真题分页"
        />
      ) : null}
    </div>
  );
}
