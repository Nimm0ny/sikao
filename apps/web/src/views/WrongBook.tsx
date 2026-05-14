import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDevice } from '@sikao/shared-utils/hooks/useDevice';
import { WrongBookMobile } from './wrong-book/WrongBookMobile';
import { AskDrawer } from '@/components/ask/AskDrawer';
import {
  WrongBookSkeleton,
  WrongQuestionList,
} from '@/components/wrong-book';
import { AuthFallbackEmptyState, PageHeader } from '@sikao/ui/ui';
import { QueryBoundary } from '@/components/data';
import { WrongBookHero } from '@/components/wrong-book/WrongBookHero';
import { WrongBookHeatmap } from '@/components/wrong-book/WrongBookHeatmap';
import { StandoutGraduation } from '@/components/wrong-book/StandoutGraduation';
import {
  WrongBookFiltersPanel,
  type ViewFilterKey,
} from '@/components/wrong-book/WrongBookFiltersPanel';
import {
  useWrongBookSummary,
  useGraduationCandidates,
} from '@sikao/api-client/queries/wrongBookQueries';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import { isAuthError } from '@sikao/shared-utils';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { ERROR_COPY } from '@/lib/ui-copy';
import {
  fetchWrongQuestions,
  retryWrongBatch,
  wrongBookKeys,
  type WrongQuestionFilters,
} from '@sikao/api-client/apiQueries';
import { api } from '@sikao/api-client/request';
import type {
  MasteryLevel,
  PaperSummaryV2,
  PracticeSessionStartV2,
} from '@sikao/api-client/types/api';

// SIKAO Wave 4 Phase 2D · 错题本主页重写 (接 W1 bdfe4f2 7 endpoint).
//
// 主页轻量化 (master 拍板 IA): Hero + Standout + FiltersPanel (7 chip viewFilter)
// + 6-col grid list. 详情移到 DetailA full-screen (/wrong-book/:questionId),
// 重做移到 DetailB (/wrong-book/:questionId/redo).
//
// view filter → mastery 映射: todo/danger/new → not_mastered, doing → reviewing,
// ok → mastered; meek (蒙对) BE 暂无, 当 danger proxy.
//
// SIKAO Wave 5: 学习热图 (5 模块 × 30 天) 集成在 Hero 下方第 1 个 section,
// --data-* token + endpoint lhr 2026-05-12 批 (§3.7 + plan sikao-wave5-roadmap).

const DEFAULT_PAGE_SIZE = 20;
const VALID_MASTERY: ReadonlySet<string> = new Set([
  'not_mastered',
  'reviewing',
  'mastered',
]);
const VALID_VIEWS: ReadonlySet<string> = new Set([
  'all',
  'todo',
  'doing',
  'danger',
  'meek',
  'ok',
  'new',
]);

function viewToMastery(view: ViewFilterKey): MasteryLevel | undefined {
  switch (view) {
    case 'todo':
    case 'danger':
    case 'meek':
    case 'new':
      return 'not_mastered';
    case 'doing':
      return 'reviewing';
    case 'ok':
      return 'mastered';
    case 'all':
    default:
      return undefined;
  }
}

function readFiltersFromSearch(params: URLSearchParams): {
  readonly filters: WrongQuestionFilters;
  readonly view: ViewFilterKey;
} {
  const subject = params.get('subject') ?? undefined;
  const subtype = params.get('subtype') ?? undefined;
  const paperCodeRaw = params.get('paperCode');
  const paperCode =
    paperCodeRaw !== null && paperCodeRaw.length > 0 ? paperCodeRaw : undefined;
  const viewRaw = params.get('view');
  const view: ViewFilterKey =
    viewRaw !== null && VALID_VIEWS.has(viewRaw)
      ? (viewRaw as ViewFilterKey)
      : 'all';
  const masteryRaw = params.get('masteryLevel');
  const masteryLevel =
    masteryRaw !== null && VALID_MASTERY.has(masteryRaw)
      ? (masteryRaw as MasteryLevel)
      : viewToMastery(view);
  const pageRaw = parseInt(params.get('page') ?? '1', 10);
  const sizeRaw = parseInt(
    params.get('pageSize') ?? `${DEFAULT_PAGE_SIZE}`,
    10,
  );
  return {
    filters: {
      subject,
      subtype,
      paperCode,
      masteryLevel,
      page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
      pageSize:
        Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : DEFAULT_PAGE_SIZE,
    },
    view,
  };
}

function buildSearch(
  filters: WrongQuestionFilters,
  view: ViewFilterKey,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.subject !== undefined) out.subject = filters.subject;
  if (filters.subtype !== undefined) out.subtype = filters.subtype;
  if (filters.paperCode !== undefined) out.paperCode = filters.paperCode;
  if (view !== 'all') out.view = view;
  if (filters.page !== undefined && filters.page !== 1) {
    out.page = String(filters.page);
  }
  if (
    filters.pageSize !== undefined &&
    filters.pageSize !== DEFAULT_PAGE_SIZE
  ) {
    out.pageSize = String(filters.pageSize);
  }
  return out;
}

/**
 * WrongBook — device-aware dispatch shell (PR9, 2026-05-13).
 *
 * mobile (<1024)  → WrongBookMobile (M5 layout: chip + 紧凑 wb-row list + 翻页)
 * tablet/desktop  → WrongBookDesktop (现有 hero + heatmap + 7-chip + grid)
 *
 * Handoff §5.1: 不新建 views/m/*.tsx; 共享 react-query queryKey cache.
 */
export default function WrongBook() {
  const device = useDevice();
  if (device === 'mobile') return <WrongBookMobile />;
  return <WrongBookDesktop />;
}

function WrongBookDesktop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = useMemo(() => readFiltersFromSearch(searchParams), [searchParams]);
  const [filters, setFiltersState] = useState<WrongQuestionFilters>(
    () => initial.filters,
  );
  const [viewFilter, setViewFilterState] = useState<ViewFilterKey>(
    () => initial.view,
  );

  const setFilters = useCallback(
    (next: WrongQuestionFilters) => {
      setFiltersState(next);
      setSearchParams(buildSearch(next, viewFilter), { replace: true });
    },
    [setSearchParams, viewFilter],
  );

  const setViewFilter = useCallback(
    (next: ViewFilterKey) => {
      setViewFilterState(next);
      const nextFilters: WrongQuestionFilters = {
        ...filters,
        masteryLevel: viewToMastery(next),
        page: 1,
      };
      setFiltersState(nextFilters);
      setSearchParams(buildSearch(nextFilters, next), { replace: true });
    },
    [filters, setSearchParams],
  );

  const paperCodeFilter = filters.paperCode;
  const clearPaperCode = useCallback(() => {
    setFilters({ ...filters, paperCode: undefined, page: 1 });
  }, [filters, setFilters]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initSession = usePracticeStore((state) => state.initSession);

  // SIKAO Wave 4 Phase 2D 7 endpoint hook.
  const summaryQuery = useWrongBookSummary();
  const gradQuery = useGraduationCandidates(3);

  const listQuery = useQuery({
    queryKey: wrongBookKeys.list(filters),
    queryFn: () => fetchWrongQuestions(filters),
  });

  // P4 audit P1-16: chip 显 paperName 而非 paperCode.
  const { data: papersList } = useQuery<readonly PaperSummaryV2[]>({
    queryKey: ['papers'],
    queryFn: () => api.get<readonly PaperSummaryV2[]>('/papers'),
    enabled: paperCodeFilter !== undefined,
  });
  const paperNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    (papersList ?? []).forEach((p) => map.set(p.paperCode, p.paperName));
    return map;
  }, [papersList]);

  // 批量复习 state + mutation (跨 paper 已支持).
  const [batchSelected, setBatchSelected] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const onToggleBatch = useCallback((qid: number) => {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }, []);

  const batchMutation = useMutation({
    mutationFn: (questionIds: readonly number[]) => retryWrongBatch(questionIds),
    onSuccess: (sessionData: PracticeSessionStartV2) => {
      initSession(sessionData);
      queryClient.invalidateQueries({ queryKey: wrongBookKeys.all });
      setBatchSelected(new Set());
      navigate(`/practice/sessions/${sessionData.sessionId}`);
    },
    onError: (err: unknown) => {
      logger.error('wrong-book.batch-retry.failed', { err: String(err) });
      toast.error('无法启动批量重做', '检查网络后重试.');
    },
  });

  // 卡片 click → 跳详情 (DetailA full-screen).
  const onSelectCard = useCallback(
    (qid: number) => {
      setSelectedId(qid);
      navigate(`/wrong-book/${qid}`);
    },
    [navigate],
  );

  // PR10 AskDrawer state — IconBtn 点 question id 打开 ask sheet/drawer.
  const [askQid, setAskQid] = useState<number | null>(null);
  const onAsk = useCallback((qid: number): void => setAskQid(qid), []);
  const closeAsk = useCallback((): void => setAskQid(null), []);

  // P0-4 ↑↓ keyboard nav (保留, 跳详情时 selectedId 仍 tracked).
  const orderedIds = useMemo(
    () => (listQuery.data?.items ?? []).map((it) => it.questionId),
    [listQuery.data],
  );

  useEffect(() => {
    if (orderedIds.length === 0) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const target = e.target as HTMLElement | null;
      if (
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const currentIdx =
        selectedId !== null ? orderedIds.indexOf(selectedId) : 0;
      const baseIdx = currentIdx >= 0 ? currentIdx : 0;
      const nextIdx =
        e.key === 'ArrowDown'
          ? Math.min(orderedIds.length - 1, baseIdx + 1)
          : Math.max(0, baseIdx - 1);
      if (nextIdx === baseIdx && currentIdx >= 0) return;
      e.preventDefault();
      setSelectedId(orderedIds[nextIdx] ?? null);
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [orderedIds, selectedId]);

  // auth 兜底: any query 401 → render auth fallback.
  if (
    (listQuery.isError && isAuthError(listQuery.error)) ||
    (summaryQuery.isError && isAuthError(summaryQuery.error))
  ) {
    return (
      <div className="p-4 md:p-6">
        <AuthFallbackEmptyState description="登录后即可查看错题本." />
      </div>
    );
  }

  return (
    <QueryBoundary
      query={listQuery}
      testId="wrongbook"
      skeleton={<WrongBookSkeleton />}
      errorTitle={ERROR_COPY.wrongBook.title}
      errorDescription={ERROR_COPY.wrongBook.description}
    >
      {(data) => {
        const { page, pageSize, total, items } = data;
        const resolvedSelected =
          items.find((it) => it.questionId === selectedId) ?? items[0];

        return (
          <div
            className="px-4 md:px-14 py-6 md:py-8 h-full flex flex-col gap-6"
            data-testid="wrong-book-view"
          >
            {/* Hero — 5 stat-strip */}
            {summaryQuery.data !== undefined ? (
              <WrongBookHero summary={summaryQuery.data} />
            ) : (
              <PageHeader
                title="错题本"
                subtitle={`累计 ${total} 题, 复习一道是一道.`}
              />
            )}

            {/* 本套错题 chip (paperCode 过滤) */}
            {paperCodeFilter !== undefined
              ? (() => {
                  const paperLabel =
                    paperNameByCode.get(paperCodeFilter) ??
                    `套卷代号 ${paperCodeFilter}`;
                  const isResolved = paperNameByCode.has(paperCodeFilter);
                  return (
                    <div
                      className="flex items-center gap-2 transition-colors duration-fast"
                      data-testid="wrong-book-paper-filter"
                    >
                      <span className="text-tiny font-mono font-semibold tracking-eyebrow uppercase text-ink-4">
                        本套错题
                      </span>
                      <button
                        type="button"
                        onClick={clearPaperCode}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-tiny border border-ink bg-ink text-white font-semibold hover:bg-ink-1 transition-colors duration-fast"
                        data-testid="wrong-book-paper-filter-clear"
                        aria-label={`清除按 ${paperLabel} 过滤`}
                      >
                        <span
                          className={
                            isResolved
                              ? 'truncate max-w-[280px]'
                              : 'font-mono tabular-nums'
                          }
                        >
                          {paperLabel}
                        </span>
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  );
                })()
              : null}

            {/* SIKAO Wave 5 · 学习热图 (5 模块 × 30 天) */}
            <WrongBookHeatmap />

            {/* Standout - 毕业候选 + smart-review 入口 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StandoutGraduation
                candidates={gradQuery.data ?? []}
                isLoading={gradQuery.isLoading}
              />
              <button
                type="button"
                onClick={() => navigate('/wrong-book/smart-review')}
                className="bg-ink text-white p-6 flex flex-col gap-3 text-left transition-colors duration-fast hover:bg-ink-1 rounded-card"
                data-testid="wrong-book-smart-review-cta"
                aria-label="进入智能复盘"
              >
                <div className="text-tiny font-mono uppercase tracking-eyebrow opacity-60">
                  智能复盘
                </div>
                <h3 className="font-serif font-semibold text-h-card leading-tight m-0">
                  亓菲线 · 五种模式复盘
                </h3>
                <p className="text-sm opacity-70 leading-relaxed flex-1 m-0">
                  基于遗忘曲线 / 错题反复次数 / 险题标签 / 考前距离的复合推送。
                </p>
                <span className="font-mono text-xs uppercase tracking-wider">
                  进入复盘 →
                </span>
              </button>
            </div>

            {/* 7-chip viewFilter Panel */}
            {summaryQuery.data !== undefined ? (
              <WrongBookFiltersPanel
                viewFilter={viewFilter}
                onChangeView={setViewFilter}
                summary={summaryQuery.data}
              />
            ) : null}

            {/* 列表 + batch toolbar + pagination */}
            <WrongQuestionList
              items={items}
              selectedId={resolvedSelected?.questionId ?? null}
              onSelect={onSelectCard}
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={(next) => setFilters({ ...filters, page: next })}
              batchSelected={batchSelected}
              onToggleBatch={onToggleBatch}
              onBatchRetry={() => {
                batchMutation.mutate(Array.from(batchSelected));
              }}
              batchRetryDisabled={batchMutation.isPending}
              batchRetryDisabledReason={
                batchMutation.isPending ? '处理中...' : undefined
              }
              onAsk={onAsk}
            />
            {askQid !== null ? (
              <AskDrawer
                open={true}
                onClose={closeAsk}
                questionId={String(askQid)}
              />
            ) : null}
          </div>
        );
      }}
    </QueryBoundary>
  );
}
