// lint-allow-ui-copy: SIK-27 PracticeCenter sections still ship with
// interim business copy before the shared Practice ui-copy namespace exists.
import { Badge, EmptyState, Skeleton } from '../../components/atom';
import { Button, Select } from '../../components/form';
import { Banner } from '../../components/overlay';
import type { CatalogItemV2 } from '@sikao/api-client/types/practice';
import type { PracticeHistoryResponseV2 } from '@sikao/api-client/types/api';
import { formatAccuracy } from './PracticeModel';
import styles from './Practice.module.css';

export function SectionA({
  segment,
  centerSummary,
  history,
  trend,
  dailyHistory,
  overallAccuracy,
  overallQuestions,
  overallMinutes,
  percentile,
  loading,
  error,
}: {
  readonly segment: 'xingce' | 'essay';
  readonly centerSummary: ReadonlyArray<{ key: string; label: string; value: string; tone: string }>;
  readonly history?: PracticeHistoryResponseV2;
  readonly trend: ReadonlyArray<{ date: string; accuracy: number }>;
  readonly dailyHistory: ReadonlyArray<{
    id: number;
    date: string;
    questionCount: number;
    completedAccuracy?: number | null;
  }>;
  readonly overallAccuracy: number;
  readonly overallQuestions: number;
  readonly overallMinutes: number;
  readonly percentile: number | null;
  readonly loading: boolean;
  readonly error: boolean;
}) {
  if (loading) return <Skeleton variant="text" lines={6} />;
  if (error) {
    return (
      <Banner
        variant="err"
        title="统计面板加载失败"
        description="请刷新后重试。"
      />
    );
  }
  if (!history || history.summary.totalAttempts === 0) {
    return (
      <EmptyState
        title="还没有练习记录"
        description="从每日一练、专项练习或套卷入口开始，Section A 会自动汇总你的历史与趋势。"
      />
    );
  }

  return (
    <div className={styles.sectionBody}>
      <div className={styles.metricCards}>
        {centerSummary.map((metric) => (
          <article key={metric.key} className={styles.metricCard}>
            <span className={styles.metricLabel}>{metric.label}</span>
            <strong className={styles.metricValue}>{metric.value}</strong>
          </article>
        ))}
      </div>
      <div className={styles.sectionSplit}>
        <div className={styles.historyList}>
          <div className={styles.blockHeader}>
            <span>{segment === 'xingce' ? '行测整体' : '申论整体'}</span>
            {percentile !== null ? <Badge variant="ok" size="sm">超越 {percentile}%</Badge> : null}
          </div>
          <p className={styles.summaryMeta}>
            累计 {overallQuestions} 题，正确率 {formatAccuracy(overallAccuracy)}，用时 {overallMinutes} 分钟。
          </p>
          {history.recentSessions.map((session) => (
            <article key={String(session.sessionId)} className={styles.historyItem}>
              <strong>{session.paperName ?? session.mode}</strong>
              <span>
                {formatAccuracy(session.accuracyRate)} · {session.answeredQuestions}/{session.totalQuestions} 题
              </span>
            </article>
          ))}
        </div>
        <div className={styles.historyList}>
          <div className={styles.blockHeader}>
            <span>趋势</span>
            <Badge variant="neutral" size="sm">30d</Badge>
          </div>
          <div className={styles.trendBars}>
            {trend.slice(-4).map((point) => (
              <div key={point.date} className={styles.trendBarItem}>
                <span className={styles.trendLabel}>{point.date.slice(5)}</span>
                <div className={styles.trendBarTrack}>
                  <div
                    className={styles.trendBarFill}
                    style={{ width: `${Math.round(point.accuracy * 100)}%` }}
                  />
                </div>
                <span className={styles.trendValue}>{formatAccuracy(point.accuracy)}</span>
              </div>
            ))}
          </div>
          <div className={styles.blockHeader}>
            <span>每日一练历史</span>
          </div>
          {dailyHistory.map((item) => (
            <article key={item.id} className={styles.historyItem}>
              <strong>{item.date}</strong>
              <span>
                {item.questionCount} 题 ·{' '}
                {typeof item.completedAccuracy === 'number'
                  ? formatAccuracy(item.completedAccuracy)
                  : '未完成'}
              </span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CatalogSection({
  loading,
  error,
  items,
  groups,
  onRetry,
  onOpen,
}: {
  readonly loading: boolean;
  readonly error: boolean;
  readonly items: readonly CatalogItemV2[];
  readonly groups: ReadonlyArray<[string, CatalogItemV2[]]>;
  readonly onRetry: () => void;
  readonly onOpen: (item: CatalogItemV2) => void;
}) {
  if (loading) return <Skeleton variant="text" lines={8} />;
  if (error) {
    return (
      <Banner
        variant="err"
        title="专项分类加载失败"
        action={{ label: '重试', onClick: onRetry }}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="暂无专项分类"
        description="当前范围没有可用的分类入口。"
      />
    );
  }

  return (
    <div className={styles.sectionBody}>
      {groups.map(([group, children]) => (
        <details key={group} className={styles.catalogGroup} open>
          <summary>{group}</summary>
          <div className={styles.catalogItems}>
            {children.map((item) => (
              <article key={item.id} className={styles.catalogItem}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.subtitle ?? '专项入口'}</p>
                </div>
                <Button variant="secondary" onClick={() => onOpen(item)}>
                  按此配置
                </Button>
              </article>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export function PapersSection({
  loading,
  error,
  items,
  showDifficultyFilter,
  filters,
  sort,
  onRetry,
  onPatchFilters,
  onResetFilters,
  onSort,
  onStart,
}: {
  readonly loading: boolean;
  readonly error: boolean;
  readonly items: readonly CatalogItemV2[];
  readonly showDifficultyFilter: boolean;
  readonly filters: {
    year?: number | null;
    region?: string | null;
    examType?: string | null;
    difficultyMin?: number | null;
    difficultyMax?: number | null;
  };
  readonly sort: 'default' | 'recent' | 'year_desc';
  readonly onRetry: () => void;
  readonly onPatchFilters: (
    patch: {
      year?: number | null;
      region?: string | null;
      examType?: string | null;
      difficultyMin?: number | null;
      difficultyMax?: number | null;
    },
    segment?: 'xingce' | 'essay',
  ) => void;
  readonly onResetFilters: (segment?: 'xingce' | 'essay') => void;
  readonly onSort: (
    sort: 'default' | 'recent' | 'year_desc',
    segment?: 'xingce' | 'essay',
  ) => void;
  readonly onStart: (item: CatalogItemV2) => void;
}) {
  if (loading) return <Skeleton variant="text" lines={8} />;
  if (error) {
    return (
      <Banner
        variant="err"
        title="套卷列表加载失败"
        action={{ label: '重试', onClick: onRetry }}
      />
    );
  }

  const yearOptions = Array.from(
    new Set(items.map((item) => item.year).filter((value): value is number => value != null)),
  )
    .sort((a, b) => b - a)
    .map((value) => ({ value: String(value), label: `${value}` }));
  const regionOptions = Array.from(
    new Set(items.map((item) => item.region).filter((value): value is string => Boolean(value))),
  ).map((value) => ({ value, label: value }));
  const examTypeOptions = Array.from(
    new Set(items.map((item) => item.examType).filter((value): value is string => Boolean(value))),
  ).map((value) => ({ value, label: value }));

  return (
    <div className={styles.sectionBody}>
      <div className={styles.filterBar}>
        <Select
          aria-label="筛选年份"
          value={filters.year != null ? String(filters.year) : 'all'}
          onChange={(value) => onPatchFilters({ year: value === 'all' ? null : Number(value) })}
          options={[{ value: 'all', label: '全部年份' }, ...yearOptions]}
        />
        <Select
          aria-label="筛选地区"
          value={filters.region ?? 'all'}
          onChange={(value) => onPatchFilters({ region: value === 'all' ? null : value })}
          options={[{ value: 'all', label: '全部地区' }, ...regionOptions]}
        />
        <Select
          aria-label="筛选考试类型"
          value={filters.examType ?? 'all'}
          onChange={(value) => onPatchFilters({ examType: value === 'all' ? null : value })}
          options={[{ value: 'all', label: '全部考试类型' }, ...examTypeOptions]}
        />
        {showDifficultyFilter ? (
          <Select
            aria-label="筛选难度"
            value={
              filters.difficultyMax == null
                ? 'all'
                : filters.difficultyMax >= 0.75
                  ? 'hard'
                  : (filters.difficultyMin ?? 0) <= 0.25
                    ? 'easy'
                    : 'medium'
            }
            onChange={(value) => {
              if (value === 'all') return onPatchFilters({ difficultyMin: null, difficultyMax: null });
              if (value === 'easy') return onPatchFilters({ difficultyMin: 0, difficultyMax: 0.25 });
              if (value === 'medium') return onPatchFilters({ difficultyMin: 0.26, difficultyMax: 0.74 });
              return onPatchFilters({ difficultyMin: 0.75, difficultyMax: 1 });
            }}
            options={[
              { value: 'all', label: '全部难度' },
              { value: 'easy', label: '简单' },
              { value: 'medium', label: '中等' },
              { value: 'hard', label: '困难' },
            ]}
          />
        ) : null}
        <Select
          aria-label="筛选排序"
          value={sort}
          onChange={(value) => onSort(value as 'default' | 'recent' | 'year_desc')}
          options={[
            { value: 'default', label: '默认排序' },
            { value: 'recent', label: '最近优先' },
            { value: 'year_desc', label: '年份降序' },
          ]}
        />
        <Button variant="ghost" onClick={() => onResetFilters()}>
          重置筛选
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="当前筛选没有套卷"
          description="调整年份、地区或排序后再试。"
        />
      ) : (
        <div className={styles.paperList}>
          {items.map((item) => (
            <article key={item.id} className={styles.paperCard}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.subtitle ?? `${item.questionCount ?? 0} 题`}</p>
              </div>
              <div className={styles.paperMeta}>
                {item.isCompleted ? (
                  <Badge variant="ok" size="sm">
                    已完成
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm">
                    未完成
                  </Badge>
                )}
                <Button variant="secondary" onClick={() => onStart(item)}>
                  开始
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
