/**
 * SIKAO Wave 4 Phase 2D · NotesHome — 笔记本主页.
 *
 * 路由 `/notes`. layout:
 *   CaptureBar (sticky top)
 *   ↓
 *   NotesToolbar (search + source filter + sort)
 *   ↓
 *   TypeTabs (5 等分 type filter)
 *   ↓
 *   Grid 1fr / 280px:
 *     - 左主体: NoteCard grid 3 列 + infinite scroll sentinel
 *     - 右栏: ReviewStack (今日复习) + SprintCard (冲刺池)
 *
 * 数据流:
 *   - useNotes({type, sourceDomain}) — list infinite (cursor 分页)
 *   - useNotebookStats() — counts (TypeTabs / SourceFilter counts)
 *   - useDueNotes() — 今日复习队列
 *   - useCreateNote() — CaptureBar 快速添加
 *   - useSubmitReview() — ReviewStack 评分
 *   - useNationalExamCountdown() — SprintCard 国考倒计时
 *
 * 三态 (auth / loading / error / empty) 跟 Plan.tsx 同款模式 (CLAUDE.md §7
 * 验证 3 关).
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useNotes,
  useNotebookStats,
  useDueNotes,
  useCreateNote,
  useSubmitReview,
  type NoteSourceDomain,
  type NoteType,
} from '@sikao/api-client/queries/notebookQueries';
import { useNationalExamCountdown } from '@sikao/api-client/queries/examEventsQueries';
import { isAuthError } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { logger } from '@sikao/shared-utils';
import { PageHeader } from '@sikao/ui/ui/PageHeader';
import {
  Button,
  EmptyState,
  Skeleton,
  AuthFallbackEmptyState,
} from '@sikao/ui/ui';
import {
  CaptureBar,
  NotesToolbar,
  TypeTabs,
  NoteCard,
  ReviewStack,
  SprintCard,
  type CaptureInput,
  type SortMode,
  type TypeTabValue,
} from '@/components/notes';
import { AlertCircleIcon, RefreshIcon, NoteIcon } from '@sikao/ui/icons';

export default function NotesHome(): ReactElement {
  const navigate = useNavigate();

  const [typeTab, setTypeTab] = useState<TypeTabValue>('all');
  const [sourceDomain, setSourceDomain] = useState<NoteSourceDomain | 'all'>(
    'all',
  );
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('created-desc');

  const filterArg = useMemo(
    () => ({
      type: typeTab === 'all' ? undefined : (typeTab as NoteType),
      sourceDomain: sourceDomain === 'all' ? undefined : sourceDomain,
    }),
    [typeTab, sourceDomain],
  );

  const notesQuery = useNotes(filterArg);
  const statsQuery = useNotebookStats();
  const dueQuery = useDueNotes();
  const createMut = useCreateNote();
  const reviewMut = useSubmitReview();
  const { daysUntil } = useNationalExamCountdown();

  // ── infinite scroll sentinel (跟 Plan.tsx 同款) ────────────────────────
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current || !notesQuery.hasNextPage) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !notesQuery.isFetchingNextPage) {
          void notesQuery.fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [notesQuery]);

  // ── auth fallback ──────────────────────────────────────────────────────
  const hasAuthError =
    isAuthError(notesQuery.error) ||
    isAuthError(statsQuery.error) ||
    isAuthError(dueQuery.error);
  if (hasAuthError) {
    return (
      <div
        className="p-4 md:p-8 max-w-7xl mx-auto"
        data-testid="notes-home-auth-fallback"
      >
        <AuthFallbackEmptyState description="登录后即可查看你的笔记本." />
      </div>
    );
  }

  // ── loading: initial mount ────────────────────────────────────────────
  if (notesQuery.isLoading || statsQuery.isLoading) {
    return (
      <div
        className="p-4 md:p-8 max-w-7xl mx-auto space-y-4"
        data-testid="notes-home-loading"
      >
        <Skeleton heightClass="h-16" testId="notes-home-capture-skeleton" />
        <Skeleton heightClass="h-12" testId="notes-home-toolbar-skeleton" />
        <Skeleton heightClass="h-24" testId="notes-home-tabs-skeleton" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-7">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} heightClass="h-48" testId={`notes-skel-${i}`} />
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton heightClass="h-60" />
            <Skeleton heightClass="h-40" />
          </div>
        </div>
      </div>
    );
  }

  // ── error: notesQuery + statsQuery 都 fail 时 ────────────────────────
  if (notesQuery.isError && statsQuery.isError) {
    return (
      <div
        className="p-4 md:p-8 max-w-7xl mx-auto"
        data-testid="notes-home-error"
      >
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title="笔记本加载失败"
          description="检查网络后重试."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void notesQuery.refetch();
                void statsQuery.refetch();
                void dueQuery.refetch();
              }}
              data-testid="notes-home-retry"
            >
              <RefreshIcon className="w-4 h-4 mr-2" />
              重试
            </Button>
          }
        />
      </div>
    );
  }

  // ── data path ──────────────────────────────────────────────────────────
  // Wave 4 X2 verify P1: defensive — pages 来自 useInfiniteQuery 总是 array,
  // 但 page.items 在 BE 偶发非 array shape (mock 空集 / partial 502) 时
  // .flatMap 会 crash. Guard pages + items 两层.
  const pages = Array.isArray(notesQuery.data?.pages) ? notesQuery.data.pages : [];
  const allNotes = pages.flatMap((p) =>
    Array.isArray(p.items) ? p.items : [],
  );
  const sortedNotes = [...allNotes].sort((a, b) => {
    if (sortMode === 'updated-desc') {
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
  // 客户端 search filter (BE 暂未提供 q 参数, P0 简化)
  const filteredNotes = search.trim().length === 0
    ? sortedNotes
    : sortedNotes.filter((n) => {
        const lc = search.trim().toLowerCase();
        return (
          n.title.toLowerCase().includes(lc) ||
          n.sourceRef.toLowerCase().includes(lc) ||
          n.tags.some((t) => t.toLowerCase().includes(lc))
        );
      });

  const stats = statsQuery.data;
  // Wave 4 X2 verify P1: defensive — items 非 array (mock empty / 502 partial)
  // → 下游 .map crash. Array.isArray guard.
  const dueNotes = Array.isArray(dueQuery.data?.items) ? dueQuery.data.items : [];

  // counts for TypeTabs (走 stats by_type), 'all' = total.
  const typeCounts: Partial<Record<NoteType | 'all', number>> = stats
    ? {
        all: stats.total,
        quote: stats.byType.quote ?? 0,
        method: stats.byType.method ?? 0,
        reflect: stats.byType.reflect ?? 0,
        material: stats.byType.material ?? 0,
      }
    : { all: 0 };

  const sourceCounts = stats
    ? {
        all: stats.total,
        xingce: stats.bySourceDomain.xingce ?? 0,
        essay: stats.bySourceDomain.essay ?? 0,
      }
    : { all: 0, xingce: 0, essay: 0 };

  // empty: 后端 total=0 + 任何 filter 下都 0 笔记
  const isEmpty = stats?.total === 0;

  const handleCapture = (input: CaptureInput): void => {
    createMut.mutate(
      {
        type: input.type,
        body: { text: input.text },
        sourceKind: 'manual',
        sourceRef: '快速捕获',
        sourceDomain: input.sourceDomain,
        title: input.text.slice(0, 40),
        tags: [],
        visibility: 'self',
      },
      {
        onSuccess: () => {
          toast.info('已添加', '可在编辑器内继续完善');
        },
        onError: (err) => {
          logger.error('notes.capture.failed', { err: String(err) });
          toast.error('添加失败', '检查网络后重试');
        },
      },
    );
  };

  const handleReview = (noteId: number, quality: number): void => {
    reviewMut.mutate(
      { noteId, recallQuality: quality },
      {
        onError: (err) => {
          logger.error('notes.review.failed', { err: String(err) });
          toast.error('评分失败', '检查网络后重试');
        },
      },
    );
  };

  return (
    <div
      className="p-4 md:p-8 max-w-7xl mx-auto space-y-5"
      data-testid="notes-home-view"
    >
      <PageHeader
        eyebrow="Notebook · 思考"
        title="笔记本"
        subtitle="跨领域单池, 行测 + 申论统一收录. 复习走间隔重复算法, 一日 5 张, 跨域混合."
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate('/notes/new')}
            data-testid="notes-home-new-cta"
          >
            新建笔记
          </Button>
        }
      />

      <CaptureBar
        onSubmit={handleCapture}
        isSubmitting={createMut.isPending}
        testId="notes-home-capture-bar"
      />

      <NotesToolbar
        search={search}
        onSearchChange={setSearch}
        sourceDomain={sourceDomain}
        onSourceDomainChange={setSourceDomain}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        sourceCounts={sourceCounts}
        testId="notes-home-toolbar"
      />

      <TypeTabs
        value={typeTab}
        counts={typeCounts}
        onChange={setTypeTab}
        testId="notes-home-type-tabs"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-7 items-start">
        <main data-testid="notes-home-grid-area">
          {isEmpty ? (
            <EmptyState
              icon={<NoteIcon className="w-8 h-8" />}
              title="还没有笔记"
              description="从顶部捕获条快速添加, 或新建笔记开始整理."
              action={
                <Button
                  variant="primary"
                  onClick={() => navigate('/notes/new')}
                  data-testid="notes-home-empty-cta"
                >
                  新建笔记
                </Button>
              }
            />
          ) : filteredNotes.length === 0 ? (
            <EmptyState
              icon={<NoteIcon className="w-8 h-8" />}
              title="没有符合筛选的笔记"
              description="换个筛选条件试试."
            />
          ) : (
            <>
              <div
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                data-testid="notes-home-grid"
              >
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onClick={(n) => navigate(`/notes/${n.id}`)}
                  />
                ))}
              </div>
              {notesQuery.hasNextPage ? (
                <div
                  ref={sentinelRef}
                  data-testid="notes-home-sentinel"
                  className="mt-5"
                >
                  {notesQuery.isFetchingNextPage ? (
                    <Skeleton heightClass="h-24" />
                  ) : (
                    <div className="h-8" aria-hidden="true" />
                  )}
                </div>
              ) : (
                filteredNotes.length > 0 ? (
                  <p className="mt-5 py-3 text-center font-mono text-tiny tracking-wider uppercase text-ink-4">
                    已加载全部 · 共 {filteredNotes.length} 条
                  </p>
                ) : null
              )}
            </>
          )}
        </main>

        <aside
          data-testid="notes-home-aside"
          className="space-y-4 lg:sticky lg:top-4"
        >
          <ReviewStack
            notes={dueNotes}
            onSubmitReview={handleReview}
            onSkip={() => {
              toast.info('已跳过', '稍后会再次出现');
            }}
            isSubmitting={reviewMut.isPending}
            testId="notes-home-review-stack"
          />
          <SprintCard
            daysToExam={daysUntil}
            highFreqQuoteCount={typeCounts.quote ?? 0}
            methodCardCount={typeCounts.method ?? 0}
            dailySuggestion={5}
            onStart={() => toast.info('冲刺池', 'D-30 内自动激活')}
            testId="notes-home-sprint"
          />
        </aside>
      </div>
    </div>
  );
}
