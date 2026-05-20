/**
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
import { NOTES_COPY } from '@/lib/ui-copy';

function readCount(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function readCountMap(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

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
        <AuthFallbackEmptyState description={NOTES_COPY.homeRequireLogin} />
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

  // The notes list is the primary data source for this page. If it fails,
  // do not fall through to stats-driven empty state.
  if (notesQuery.isError) {
    return (
      <div
        className="p-4 md:p-8 max-w-7xl mx-auto"
        data-testid="notes-home-error"
      >
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={NOTES_COPY.homeLoadFailedTitle}
          description={NOTES_COPY.homeLoadFailedDesc}
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
              {NOTES_COPY.homeRetry}
            </Button>
          }
        />
      </div>
    );
  }

  // ── data path ──────────────────────────────────────────────────────────
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
  const searchTerm = search.trim().toLowerCase();
  // 客户端 search filter (BE 暂未提供 q 参数, P0 简化)
  const filteredNotes = searchTerm === ''
    ? sortedNotes
    : sortedNotes.filter((n) => {
        return (
          n.title.toLowerCase().includes(searchTerm) ||
          n.sourceRef.toLowerCase().includes(searchTerm) ||
          n.tags.some((t) => t.toLowerCase().includes(searchTerm))
        );
      });

  const stats = statsQuery.data;
  const statsTotal = Math.max(readCount(stats?.total), allNotes.length);
  const statsByType = readCountMap(stats?.byType);
  const statsBySourceDomain = readCountMap(stats?.bySourceDomain);
  // → 下游 .map crash. Array.isArray guard.
  const dueNotes = Array.isArray(dueQuery.data?.items) ? dueQuery.data.items : [];

  // counts for TypeTabs (走 stats by_type), 'all' = total.
  const typeCounts: Partial<Record<NoteType | 'all', number>> = stats
    ? {
        all: statsTotal,
        quote: readCount(statsByType.quote),
        method: readCount(statsByType.method),
        reflect: readCount(statsByType.reflect),
        material: readCount(statsByType.material),
      }
    : { all: allNotes.length };

  const sourceCounts = stats
    ? {
        all: statsTotal,
        xingce: readCount(statsBySourceDomain.xingce),
        essay: readCount(statsBySourceDomain.essay),
      }
    : { all: allNotes.length, xingce: 0, essay: 0 };

  // empty: 后端 total=0 + 任何 filter 下都 0 笔记
  const isEmpty = allNotes.length === 0 && statsTotal === 0;

  const handleCapture = (input: CaptureInput): void => {
    createMut.mutate(
      {
        type: input.type,
        body: { text: input.text },
        sourceKind: 'manual',
        sourceRef: NOTES_COPY.homeQuickCaptureSourceRef,
        sourceDomain: input.sourceDomain,
        title: input.text.slice(0, 40),
        tags: [],
        visibility: 'self',
      },
      {
        onSuccess: () => {
          toast.info(
            NOTES_COPY.homeCreateSuccessTitle,
            NOTES_COPY.homeCreatedHint,
          );
        },
        onError: (err) => {
          logger.error('notes.capture.failed', { err: String(err) });
          toast.error(
            NOTES_COPY.homeCreateFailedTitle,
            NOTES_COPY.homeCreateRetry,
          );
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
          toast.error(
            NOTES_COPY.homeReviewFailedTitle,
            NOTES_COPY.homeReviewRetry,
          );
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
        eyebrow={NOTES_COPY.homeEyebrow}
        title={NOTES_COPY.homeTitle}
        subtitle={NOTES_COPY.homeSubtitle}
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate('/notes/new')}
            data-testid="notes-home-new-cta"
          >
            {NOTES_COPY.homeNewCta}
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
              title={NOTES_COPY.homeEmpty}
              description={`${NOTES_COPY.homeEmptyHint1}${NOTES_COPY.homeEmptyHint2}`}
              action={
                <Button
                  variant="primary"
                  onClick={() => navigate('/notes/new')}
                  data-testid="notes-home-empty-cta"
                >
                  {NOTES_COPY.homeNewCta}
                </Button>
              }
            />
          ) : filteredNotes.length === 0 ? (
            <EmptyState
              icon={<NoteIcon className="w-8 h-8" />}
              title={NOTES_COPY.homeFilteredEmpty}
              description={NOTES_COPY.homeFilteredEmptyHint}
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
                    {NOTES_COPY.homeLoadedAllCount(filteredNotes.length)}
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
              toast.info(
                NOTES_COPY.homeSkipTitle,
                NOTES_COPY.homeReviewLater,
              );
            }}
            isSubmitting={reviewMut.isPending}
            testId="notes-home-review-stack"
          />
          <SprintCard
            daysToExam={daysUntil}
            highFreqQuoteCount={typeCounts.quote ?? 0}
            methodCardCount={typeCounts.method ?? 0}
            dailySuggestion={5}
            onStart={() =>
              toast.info(
                NOTES_COPY.homeSprintToastTitle,
                `D-30 ${NOTES_COPY.homeReviewActive}`,
              )
            }
            testId="notes-home-sprint"
          />
        </aside>
      </div>
    </div>
  );
}
