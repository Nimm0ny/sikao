// lint-allow-ui-copy: SIK-27/28 PracticeCenter copy stays inline until the
// shared Practice ui-copy namespace lands.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/form/Button';
import { ScopeToggle } from '../../components/business';
import { Skeleton } from '../../components/atom';
import { PageHeader, Panel } from '../../components/layout';
import { Banner } from '../../components/overlay';
import { fetchPracticeHistory, historyKeys } from '@sikao/api-client/apiQueries';
import { useDailyPractice, useDailyPracticeHistory } from '@sikao/api-client/queries/dailyPracticeQueries';
import { useEssayCategories, useEssayPapers, usePracticeCenter, useXingceCategories, useXingcePapers } from '@sikao/api-client/queries/practiceContentQueries';
import { usePracticePreferences } from '@sikao/api-client/queries/practicePreferencesQueries';
import { usePracticeStats, usePracticeStatsPercentile, usePracticeStatsTrend } from '@sikao/api-client/queries/practiceStatsQueries';
import { useActivePracticeSessions, useCreatePracticeSession } from '@sikao/api-client/queries/sessionQueries';
import type { CatalogItemV2, PracticePreferencesResponseV2 } from '@sikao/api-client/types/practice';
import type { PracticeHistoryResponseV2 } from '@sikao/api-client/types/api';
import { usePracticeCenterStore, useSessionConfigStore } from '@sikao/domain';
import { useDevice } from '@sikao/shared-utils';
import { CustomPracticeDialog } from './CustomPracticeDialog';
import { CatalogSection, PapersSection, SectionA } from './PracticeSections';
import { buildCategoryGroups, buildCustomSessionPayload, type CustomPracticeDraft } from './PracticeModel';
import styles from './Practice.module.css';

type PracticeScope = 'xingce' | 'essay';
type Notice = { readonly variant: 'ok' | 'warn' | 'err'; readonly title: string; readonly description?: string };

function buildDialogKey(
  open: boolean,
  scope: PracticeScope,
  preset: Pick<CustomPracticeDraft, 'categoryL1' | 'categoryL2'> | null,
  preferences?: PracticePreferencesResponseV2,
) {
  return [
    open ? 'open' : 'closed',
    scope,
    preset?.categoryL1 ?? '',
    preset?.categoryL2 ?? '',
    preferences?.updatedAt ?? preferences?.schemaVersion ?? 'default',
  ].join(':');
}

export function Practice() {
  const navigate = useNavigate();
  const device = useDevice();
  const segment = usePracticeCenterStore((state) => state.segment);
  const setSegment = usePracticeCenterStore((state) => state.setSegment);
  const patchFilters = usePracticeCenterStore((state) => state.patchFilters);
  const resetFilters = usePracticeCenterStore((state) => state.resetFilters);
  const setSort = usePracticeCenterStore((state) => state.setSort);
  const filters = usePracticeCenterStore((state) => state.getActiveFilters());
  const sort = usePracticeCenterStore((state) => state.getActiveSort());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [preset, setPreset] = useState<Pick<CustomPracticeDraft, 'categoryL1' | 'categoryL2'> | null>(null);

  const preferencesQuery = usePracticePreferences();
  const centerQuery = usePracticeCenter();
  const statsQuery = usePracticeStats({ type: segment });
  const trendQuery = usePracticeStatsTrend({ type: segment, period: '30d' });
  const percentileQuery = usePracticeStatsPercentile({ type: segment });
  const dailyQuery = useDailyPractice(segment);
  const dailyHistoryQuery = useDailyPracticeHistory({ type: segment });
  const activeSessionsQuery = useActivePracticeSessions();
  const historyQuery = useQuery<PracticeHistoryResponseV2>({
    queryKey: [...historyKeys.all, segment],
    queryFn: fetchPracticeHistory,
  });

  const xingceCategoriesQuery = useXingceCategories({ level: 2 });
  const essayCategoriesQuery = useEssayCategories({ level: 2 });
  const xingcePapersQuery = useXingcePapers({
    year: filters.year ?? undefined,
    region: filters.region ?? undefined,
    exam_type: filters.examType ?? undefined,
    difficulty:
      filters.difficultyMax == null
        ? undefined
        : filters.difficultyMax >= 0.75
          ? 'hard'
          : (filters.difficultyMin ?? 0) <= 0.25
            ? 'easy'
            : 'medium',
    sort: sort === 'default' ? undefined : sort,
  });
  const essayPapersQuery = useEssayPapers({
    year: filters.year ?? undefined,
    region: filters.region ?? undefined,
    exam_type: filters.examType ?? undefined,
  });

  const categoriesQuery = segment === 'xingce' ? xingceCategoriesQuery : essayCategoriesQuery;
  const papersQuery = segment === 'xingce' ? xingcePapersQuery : essayPapersQuery;
  const categoryItems = useMemo(() => categoriesQuery.data?.items ?? [], [categoriesQuery.data]);
  const paperItems = papersQuery.data?.items ?? [];
  const categoryGroups = useMemo(() => buildCategoryGroups(categoryItems), [categoryItems]);
  const dialogKey = buildDialogKey(dialogOpen, segment, preset, preferencesQuery.data);

  const createSession = useCreatePracticeSession();

  useEffect(() => {
    usePracticeCenterStore.getState().hydrate();
    useSessionConfigStore.getState().hydrateFromLocalFallback();
  }, []);

  useEffect(() => {
    if (!preferencesQuery.data) return;
    useSessionConfigStore.getState().bootstrapFromPracticePreferences({
      schemaVersion: preferencesQuery.data.schemaVersion,
      payload: { customPractice: preferencesQuery.data.payload.customPractice },
    });
  }, [preferencesQuery.data]);

  async function handleCreateDaily() {
    if (!dailyQuery.data) return;
    try {
      const session = await createSession.mutateAsync({
        track: segment,
        entryKind: 'daily',
        mode: 'daily',
        practiceMode: 'full_set',
        config: { dailyPracticeId: dailyQuery.data.id },
      });
      navigate(`/practice/sessions/${session.id}`);
    } catch (error) {
      setNotice({ variant: 'err', title: '每日一练创建失败', description: String(error) });
    }
  }

  function handleContinueLast() {
    const active = activeSessionsQuery.data?.sessions?.[0];
    if (!active) return;
    navigate(`/practice/sessions/${active.id}`);
  }

  async function handleStartPaper(item: CatalogItemV2) {
    try {
      const session = await createSession.mutateAsync({
        track: segment,
        entryKind: 'paper',
        practiceMode: 'full_set',
        paperCode: item.paperCode ?? undefined,
      });
      navigate(`/practice/sessions/${session.id}`);
    } catch (error) {
      setNotice({ variant: 'err', title: '套卷创建失败', description: String(error) });
    }
  }

  async function handleSubmitCustom(draft: CustomPracticeDraft) {
    try {
      if (draft.sourceMode === 'ai_generated') {
        const params = new URLSearchParams({
          type: segment,
          yearRange: draft.yearRange,
          difficultyMin: String(draft.difficultyMin),
          difficultyMax: String(draft.difficultyMax),
          count: String(draft.count),
          practiceMode: draft.practiceMode,
          excludeDone: String(draft.excludeDone),
          onlyWrong: String(draft.onlyWrong),
        });
        if (draft.categoryL1) params.set('categoryL1', draft.categoryL1);
        if (draft.categoryL2) params.set('categoryL2', draft.categoryL2);
        navigate(`/practice/ai-questions/generating?${params.toString()}`);
        return;
      }

      const session = await createSession.mutateAsync(buildCustomSessionPayload(segment, draft));
      await useSessionConfigStore.getState().patchDefaults({
        lastUsedSourceMode: draft.sourceMode,
        lastUsedYearRange: draft.yearRange,
        lastUsedDifficultyRange: [draft.difficultyMin, draft.difficultyMax],
        lastUsedCount: draft.count,
        lastUsedPracticeMode: draft.practiceMode,
        lastUsedExcludeDone: draft.excludeDone,
        lastUsedOnlyWrong: draft.onlyWrong,
      });
      navigate(`/practice/sessions/${session.id}`);
    } catch (error) {
      setNotice({ variant: 'err', title: '创建练习失败', description: String(error) });
    }
  }

  const isPageError = centerQuery.isError || statsQuery.isError;
  const isPageLoading = !isPageError && (centerQuery.isLoading || statsQuery.isLoading);

  return (
    <div className={styles.root} data-testid="practice-view">
      <PageHeader
        title="练习中心"
        subtitle="历史记录、专项入口、套卷筛选与自定义刷题都在这里"
        actions={(
          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={() => navigate('/profile/practice-preferences')}>
              练习偏好
            </Button>
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              自定义刷题
            </Button>
          </div>
        )}
      />

      {notice ? (
        <Banner
          variant={notice.variant}
          title={notice.title}
          description={notice.description}
          dismissible
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      <div className={styles.summaryRow}>
        <ScopeToggle
          scopes={[
            { key: 'xingce', label: '行测' },
            { key: 'essay', label: '申论' },
          ]}
          active={segment}
          onChange={(value) => setSegment(value as PracticeScope)}
          aria-label="练习范围"
        />
        <div className={styles.quickActions}>
          <Button variant="secondary" onClick={() => navigate('/practice/mock-exam/start')}>
            Mock exam
          </Button>
          <Button variant="secondary" onClick={() => void handleCreateDaily()} disabled={dailyQuery.isLoading}>
            {dailyQuery.data ? `每日一练 ${dailyQuery.data.questionCount} 题` : '每日一练'}
          </Button>
          <Button variant="secondary" onClick={handleContinueLast} disabled={(activeSessionsQuery.data?.count ?? 0) === 0}>
            {(activeSessionsQuery.data?.count ?? 0) > 0 ? '继续上次' : '无未完成练习'}
          </Button>
          <Button variant="ghost" onClick={() => { setPreset(null); setDialogOpen(true); }}>
            高级筛选
          </Button>
        </div>
      </div>

      {isPageLoading ? (
        <div className={styles.grid}>
          <Panel title="加载中"><Skeleton variant="text" lines={6} /></Panel>
          <Panel title="加载中"><Skeleton variant="text" lines={6} /></Panel>
          <Panel title="加载中"><Skeleton variant="text" lines={6} /></Panel>
        </div>
      ) : isPageError ? (
        <Banner
          variant="err"
          title="练习中心加载失败"
          description="请刷新后重试。"
          action={{ label: '重试', onClick: () => { void centerQuery.refetch(); void statsQuery.refetch(); } }}
        />
      ) : (
        <div className={styles.grid}>
          <Panel title="Section A · 历史记录 / stats / trend">
            <SectionA
              segment={segment}
              centerSummary={centerQuery.data?.summary ?? []}
              history={historyQuery.data}
              trend={trendQuery.data?.points ?? []}
              dailyHistory={dailyHistoryQuery.data ?? []}
              overallAccuracy={statsQuery.data?.overall.accuracy ?? 0}
              overallQuestions={statsQuery.data?.overall.totalQuestions ?? 0}
              overallMinutes={statsQuery.data?.overall.totalMinutes ?? 0}
              percentile={percentileQuery.data?.percentileRank ?? null}
              loading={historyQuery.isLoading || trendQuery.isLoading || dailyHistoryQuery.isLoading}
              error={historyQuery.isError || trendQuery.isError || dailyHistoryQuery.isError}
            />
          </Panel>

          <Panel title="Section B · 专项练习入口">
            <CatalogSection
              loading={categoriesQuery.isLoading}
              error={categoriesQuery.isError}
              items={categoryItems}
              groups={categoryGroups}
              onRetry={() => void categoriesQuery.refetch()}
              onOpen={(item) => {
                setPreset({ categoryL1: item.categoryL1 ?? '', categoryL2: item.categoryL2 ?? '' });
                setDialogOpen(true);
              }}
            />
          </Panel>

          <Panel title="Section C · 套卷练习入口">
            <PapersSection
              loading={papersQuery.isLoading}
              error={papersQuery.isError}
              items={paperItems}
              showDifficultyFilter={segment === 'xingce'}
              filters={filters}
              sort={sort}
              onRetry={() => void papersQuery.refetch()}
              onPatchFilters={patchFilters}
              onResetFilters={resetFilters}
              onSort={setSort}
              onStart={(item) => void handleStartPaper(item)}
            />
          </Panel>
        </div>
      )}

      <CustomPracticeDialog
        key={dialogKey}
        open={dialogOpen}
        scope={segment}
        categoryItems={categoryItems}
        preferencesResponse={preferencesQuery.data}
        preset={preset}
        device={device}
        busy={createSession.isPending}
        onClose={() => { setDialogOpen(false); setPreset(null); }}
        onSubmit={(draft: CustomPracticeDraft) => void handleSubmitCustom(draft)}
      />
    </div>
  );
}
