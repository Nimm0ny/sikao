// lint-allow-ui-copy: V5-M3.5 page skeleton — placeholder copy is stand-in
// for design.md §D.4.1 prose. ui-copy SSOT migration tracked under future
// Phase 6+. Real strings will land via @/lib/ui-copy when business Phase
// integrations replace the placeholders.
import { useEffect } from 'react';
import { Numeric } from '../../components/atom';
import { Badge } from '../../components/atom';
import { Panel, PageHeader } from '../../components/layout';
import { Button } from '../../components/form';
import { useDashboardPreferenceStore, usePlanStore } from '@sikao/domain';
import type { PlanCalendarView } from '@sikao/domain/plan/usePlanStore';
import { PlanSection } from './sections/PlanSection';
import { TodayCalendarView } from './sections/TodayCalendarView';
import { WeekCalendarView } from './sections/WeekCalendarView';
import styles from './Home.module.css';

/*
 * Home view — V5 D.4.1 desktop page skeleton.
 *
 * Why: container tree per design.md §D.4.1 — 4-row Workspace grid
 *      (topbar / metric-row × 4 / Calendar / BottomRow × 3). Renders
 *      placeholder data only; the real metrics + calendar engine wire-up
 *      ships with each business Phase (Home Phase SIK-29 already owns
 *      its own runtime track via api/v2 endpoints, but this skeleton is
 *      the V5 visual contract for that integration to land into).
 *
 *      Fail-fast: throws on negative metric values (defensive guard while
 *      placeholder data is in play; remove once the API client lands).
 */

interface HomeMetric {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit?: string;
  readonly delta?: { readonly direction: 'up' | 'down' | 'flat'; readonly text: string };
}

interface HomeTask {
  readonly id: string;
  readonly title: string;
  readonly badge: { readonly variant: 'cat-yanyu' | 'cat-shuliang' | 'cat-panduan' | 'cat-ziliao' | 'cat-shenlun'; readonly label: string };
  readonly status: string;
}

interface HomeRecommendation {
  readonly id: string;
  readonly title: string;
  readonly meta: string;
}

const PLACEHOLDER_METRICS: ReadonlyArray<HomeMetric> = [
  { key: 'practice', label: '本周练习', value: 128, unit: '题', delta: { direction: 'up', text: '+12 vs 上周' } },
  { key: 'accuracy', label: '正确率', value: 76.4, unit: '%', delta: { direction: 'up', text: '+2.1 pp' } },
  { key: 'duration', label: '学习时长', value: 4.5, unit: '小时', delta: { direction: 'flat', text: '与上周持平' } },
  { key: 'rank', label: '同省排名', value: 132, delta: { direction: 'down', text: '下滑 8 位' } },
];

const PLACEHOLDER_TASKS: ReadonlyArray<HomeTask> = [
  { id: 't1', title: '言语理解 · 主旨概括 10 题', badge: { variant: 'cat-yanyu', label: '言语' }, status: '未开始' },
  { id: 't2', title: '资料分析 · 增长率综合', badge: { variant: 'cat-ziliao', label: '资料' }, status: '进行中' },
  { id: 't3', title: '判断推理 · 类比专项', badge: { variant: 'cat-panduan', label: '判断' }, status: '已完成' },
];

const PLACEHOLDER_RECOMMENDATIONS: ReadonlyArray<HomeRecommendation> = [
  { id: 'r1', title: '2024 国考 · 行测真题', meta: '120 题 · 120 分钟' },
  { id: 'r2', title: '2024 省考联考 · 江苏卷', meta: '135 题 · 120 分钟' },
  { id: 'r3', title: '事业单位 · 综合能力', meta: '100 题 · 90 分钟' },
];

const VIEW_KEYS = ['today', 'week', 'month'] as const satisfies ReadonlyArray<PlanCalendarView>;

function isPlanCalendarView(value: unknown): value is PlanCalendarView {
  return typeof value === 'string' && (VIEW_KEYS as ReadonlyArray<string>).includes(value);
}

function CalendarBody() {
  const view = usePlanStore((s) => s.currentView);
  if (view === 'today') return <TodayCalendarView />;
  if (view === 'week') return <WeekCalendarView />;
  // Month body lands in SIK-90 wave 2 commit 2 (per plan §3.2 Wave Plan).
  return (
    <div className={styles.calendarPlaceholder} data-testid="home-calendar-placeholder">
      <p>月视图骨架将在 SIK-90 wave 2 落地，包含月格 + 跨日事件分片。</p>
    </div>
  );
}

function MetricCard({ metric }: { readonly metric: HomeMetric }) {
  if (!Number.isFinite(metric.value) || metric.value < 0) {
    throw new Error(`Home metric "${metric.key}" must be a non-negative finite number, got ${metric.value}`);
  }
  return (
    <article className={styles.metricCard} data-testid={`home-metric-${metric.key}`}>
      <span className={styles.metricLabel}>{metric.label}</span>
      <Numeric value={metric.value} unit={metric.unit} size="h2" emphasis="value" />
      {metric.delta !== undefined ? (
        <span className={styles.metricDelta} data-direction={metric.delta.direction}>
          {metric.delta.text}
        </span>
      ) : null}
    </article>
  );
}

export function Home() {
  // SIK-90 Home M-A wave 1 (2026-05-24): hydrate the persisted calendar
  // view (homeCalendarView preference) into usePlanStore once on mount so
  // PlanSection / future calendar bodies render the right view without
  // flashing the store default. patchPreferences happens elsewhere on
  // user interaction; this is a one-way bootstrap.
  useEffect(() => {
    const persisted =
      useDashboardPreferenceStore.getState().preferences?.['homeCalendarView'];
    if (isPlanCalendarView(persisted)) {
      usePlanStore.getState().setCurrentView(persisted);
    }
  }, []);

  return (
    <div className={styles.root} data-testid="home-view">
      <PageHeader
        title="早上好，lhr"
        subtitle="距离 2026 国考还有 168 天"
        actions={<Button variant="primary">开始练习</Button>}
      />

      <section className={styles.metricRow} aria-label="本周学习概览">
        {PLACEHOLDER_METRICS.map((m) => <MetricCard key={m.key} metric={m} />)}
      </section>

      <PlanSection>
        <CalendarBody />
      </PlanSection>

      <section className={styles.bottomRow} aria-label="底部模块">
        <Panel title="今日任务">
          <ul className={styles.taskList} role="list">
            {PLACEHOLDER_TASKS.map((task) => (
              <li key={task.id} className={styles.taskItem}>
                <Badge variant={task.badge.variant} size="sm">{task.badge.label}</Badge>
                <span className={styles.taskTitle}>{task.title}</span>
                <span className={styles.taskStatus}>{task.status}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="错题回顾">
          <div className={styles.reviewSummary}>
            <Numeric value={42} unit="题" size="h1" emphasis="value" />
            <div className={styles.reviewBadges} aria-label="错题难度分布">
              <Badge variant="ok" size="sm">简单 12</Badge>
              <Badge variant="warn" size="sm">中等 18</Badge>
              <Badge variant="err" size="sm">困难 12</Badge>
            </div>
            <Button variant="secondary">开始回顾</Button>
          </div>
        </Panel>

        <Panel title="推荐套题">
          <ul className={styles.recommendList} role="list">
            {PLACEHOLDER_RECOMMENDATIONS.map((rec) => (
              <li key={rec.id} className={styles.recommendItem}>
                <span className={styles.recommendTitle}>{rec.title}</span>
                <span className={styles.recommendMeta}>{rec.meta}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </div>
  );
}
