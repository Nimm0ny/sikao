/**
 * SIKAO Wave 3 PR0 · 学习计划 view (07 hifi 落地, sikao-redesign plan §0.4).
 *
 * 路由: /plan (替代 /study-plan/history + /study-plan/history/:planId 两路由).
 * 数据流方案 A (master 拍板, 0 BE 改):
 *   - useStudyPlanToday() — 今日 plan (即时显在 today 那一天)
 *   - useStudyPlanHistory() — infinite 拉历史 list (slim items, 客户端按周分组)
 *   - useStudyPlanDetail() — 点 day 时 lazy fetch 单 plan full task (PR1 视情况启用)
 *
 * PR0 范围:
 *   - 周视图 infinite scroll (5 周一次, 滚到底加载更多)
 *   - PlanHead 国考倒计时 helper 复用 (lib/exam-countdown.ts)
 *   - PlanDay 三态 (done/today/future), task click 触发 routing (复用
 *     useStudyPlanRouting hook — Dashboard 同用, 不再 fork 实现保 SSOT)
 *   - PlanAssistant 块硬编码 3 文案 (按 today 任务量 / 完成度 切换)
 *
 * PR1 backlog (留下 session):
 *   - PlanDay onClick 整天卡 → lazy fetch + drawer 展示当天 task list
 *   - 完成进度 ring / 周指标实时算 (今 weekCompletedDays 走 history slim
 *     taskCompleted/Total 静态, real-time refresh PR1 接 patch 后 invalidate)
 *
 * PR2 backlog:
 *   - PlanAssistant LLM 接入 (BE 出 narrative 字段 → 替换硬编码文案)
 *   - "好, 调整一下" → POST /study-plan/regenerate
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStudyPlanToday,
  useStudyPlanHistory,
} from '@sikao/api-client/queries/studyPlanQueries';
import { useStudyPlanRouting } from '@sikao/domain/study-record/useStudyPlanRouting';
import { useNationalExamCountdown } from '@sikao/api-client/queries/examEventsQueries';
import { toast } from '@sikao/shared-utils';
import {
  Button,
  EmptyState,
  Skeleton,
  AuthFallbackEmptyState,
} from '@sikao/ui/ui';
import {
  PlanHead,
  PlanTrack,
  PlanAssistant,
} from '@/components/plan';
import {
  buildWeeks,
  isoWeekNumber,
  pickAssistantNarrative,
} from '@/components/plan/_planHelpers';
import { isAuthError } from '@sikao/shared-utils';
import { ERROR_COPY } from '@/lib/ui-copy';
import { AlertCircleIcon, RefreshIcon, SubjectPlanIcon } from '@sikao/ui/icons';

// ── view ────────────────────────────────────────────────────────────────────

export default function Plan(): ReactElement {
  const navigate = useNavigate();
  const today = useStudyPlanToday();
  const history = useStudyPlanHistory();
  const { handleTaskClick } = useStudyPlanRouting();

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingNextPageRef = useRef(history.isFetchingNextPage);
  useEffect(() => {
    isFetchingNextPageRef.current = history.isFetchingNextPage;
  }, [history.isFetchingNextPage]);

  const observeSentinel = useCallback(
    (node: HTMLDivElement | null) => {
      if (node === null) return undefined;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !isFetchingNextPageRef.current) {
            void history.fetchNextPage();
          }
        },
        { rootMargin: '200px' },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [history],
  );

  useEffect(() => {
    if (sentinelRef.current === null || !history.hasNextPage) return;
    return observeSentinel(sentinelRef.current);
  }, [history.hasNextPage, observeSentinel]);

  // ── data states (auth fail / loading / error / data) ──────────────────────
  const todayDate = useMemo(() => new Date(), []);

  // Wave 4 X2: 国考倒计时走 useNationalExamCountdown — BE /exam-events 全集
  // filter category=='national' 升序 first. loading / error / 空集 退 hardcode
  // 兜底; error 走 toast (hook 内自动). 跨日重渲 daysUntil 由 hook 计算.
  // Wave 5C P2-1: 不再格式化 examDateLabel — PlanHead h1 改用 examLabel
  // (跟 Login subtitle 一致 "距 ${examLabel}还有 N 天").
  const { examLabel, daysUntil: days } = useNationalExamCountdown();

  const currentWeekNum = isoWeekNumber(todayDate);
  // 总周数 cap: max(currentWeek, ceil(daysUntilExam/7))
  const totalWeekNum = Math.max(
    currentWeekNum,
    Math.ceil(Math.max(days, 0) / 7) + currentWeekNum,
  );

  // ── early returns ────────────────────────────────────────────────────────

  // auth fail (sticky 401 — 任一 query 401 即 fall back)
  const hasAuthError =
    isAuthError(today.error) || isAuthError(history.error);

  if (hasAuthError) {
    return (
      <div
        className="p-4 md:p-8 max-w-5xl mx-auto"
        data-testid="plan-view-auth-fallback"
      >
        <AuthFallbackEmptyState description="登录后即可查看你的学习计划。" />
      </div>
    );
  }

  // loading: today + history 任一 loading 显 skeleton (initial mount)
  if (today.isLoading || history.isLoading) {
    return (
      <div
        className="p-[var(--sp-7)] max-w-5xl mx-auto space-y-6"
        data-testid="plan-view-loading"
      >
        <Skeleton heightClass="h-32" testId="plan-head-skeleton" />
        <Skeleton heightClass="h-48" testId="plan-week-skeleton-1" />
        <Skeleton heightClass="h-48" testId="plan-week-skeleton-2" />
      </div>
    );
  }

  // error: today + history 都失败时 → retry; 单 query 失败 inline 降级
  // (CLAUDE.md frontend §2.4 fail-fast 软降级 — view 层兜底, 不 silent catch).
  if (today.isError && history.isError) {
    return (
      <div
        className="p-4 md:p-8 max-w-5xl mx-auto"
        data-testid="plan-view-error"
      >
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={ERROR_COPY.studyPlanHistory.title}
          description={ERROR_COPY.studyPlanHistory.description}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void today.refetch();
                void history.refetch();
              }}
              data-testid="plan-view-retry"
            >
              <RefreshIcon className="w-4 h-4 mr-2" />
              重试
            </Button>
          }
        />
      </div>
    );
  }

  // ── data path ────────────────────────────────────────────────────────────
  // Wave 4 X2 verify P1: defensive — pages 来自 useInfiniteQuery 总是 array,
  // 但 page.items 在 BE 偶发非 array shape (mock 空集 / partial 502) 时
  // .flatMap 会 crash. Guard pages + items 两层.
  const historyPages = Array.isArray(history.data?.pages)
    ? history.data.pages
    : [];
  const historyItems = historyPages.flatMap((p) =>
    Array.isArray(p.items) ? p.items : [],
  );
  const weeks = buildWeeks(today.data, historyItems, todayDate);
  // empty 判定: today plan 缺失 + 历史无 items. buildWeeks 总会返 today 周作 anchor,
  // 所以 weeks.length 永远 >= 1, 不能用 weeks.length === 0 判 empty.
  const isEmpty = today.data == null && historyItems.length === 0;

  if (isEmpty) {
    return (
      <div
        className="p-4 md:p-8 max-w-5xl mx-auto"
        data-testid="plan-view-empty"
      >
        <EmptyState
          icon={<SubjectPlanIcon className="w-8 h-8" />}
          title="还没有学习计划"
          description="去 Dashboard 启动今日推荐, 然后回来看完整周视图."
          action={
            <Button
              variant="secondary"
              onClick={() => navigate('/dashboard#today-plan')}
              data-testid="plan-view-empty-cta"
            >
              回 Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  // 当前周 days 完成数 (周 anchor today 找)
  const currentWeek = weeks.find((w) =>
    w.days.some((d) => d.status === 'today'),
  );
  const weekCompletedDays = currentWeek == null
    ? 0
    : currentWeek.days.filter((d) => d.status === 'done').length;

  const narrative = pickAssistantNarrative(today.data);

  return (
    <div
      className="p-[var(--sp-7)] max-w-5xl mx-auto bg-[color:var(--paper-1)]"
      data-testid="plan-view"
    >
      <PlanHead
        examLabel={examLabel}
        daysUntilExam={days}
        currentWeekNum={currentWeekNum}
        totalWeekNum={totalWeekNum}
        weekCompletedDays={weekCompletedDays}
        monthHours={0}
        monthMinutes={0}
      />

      <div data-testid="plan-tracks">
        {weeks.map((week) => (
          <PlanTrack
            key={week.weekStartDate}
            weekNum={week.weekNum}
            dateRangeLabel={week.dateRangeLabel}
            days={week.days.map((day) => ({
              ...day,
              onTaskClick: (taskId: string) => {
                // 仅 today 那天 task 是 BE StudyTaskResponse — 走 task routing.
                // 其他天的 'summary-N' / 'rest-N' clickable=false 不会进这个 callback.
                if (today.data == null) return;
                const numId = Number(taskId);
                if (Number.isNaN(numId)) return;
                const found = today.data.tasks.find((t) => t.id === numId);
                if (found != null) {
                  handleTaskClick(found);
                }
              },
            }))}
          />
        ))}
      </div>

      {/* infinite scroll sentinel — hifi 设计未画 sentinel 视觉, 复用
          StudyPlanHistory IntersectionObserver pattern. nextCursor=null 后整段不渲. */}
      {history.hasNextPage ? (
        <div
          ref={sentinelRef}
          data-testid="plan-view-sentinel"
          className="mt-[var(--sp-5)]"
        >
          {history.isFetchingNextPage ? (
            <Skeleton heightClass="h-32" />
          ) : (
            <div className="h-8" aria-hidden="true" />
          )}
        </div>
      ) : (
        <div
          className="mt-[var(--sp-5)] py-3 text-center font-mono text-tiny uppercase tracking-wider text-[color:var(--ink-3)]"
          data-testid="plan-view-end"
        >
          加载完成
        </div>
      )}

      <PlanAssistant
        narrative={narrative}
        actions={[
          {
            id: 'keep',
            label: '不用，按原计划',
            variant: 'secondary',
            onClick: () => {
              toast.info('已记录你的偏好。');
            },
          },
          {
            id: 'adjust',
            label: '好，调整一下',
            variant: 'primary',
            onClick: () => {
              toast.info('计划调整功能即将上线。');
            },
          },
        ]}
      />
    </div>
  );
}
