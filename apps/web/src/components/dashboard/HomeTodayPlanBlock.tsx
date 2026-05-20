/**
 * SIKAO Wave 8 Phase C · Home block 2 — 今日计划.
 *
 * 数据源: useTodayStudyPlan() → StudyPlanResponse | null.
 * 显示: 今日 task chip × N + 完成进度 dot + Wave 8 Phase A 加的 daily_quota /
 * daily_accuracy_target 可见.
 * Empty 态: "今日无计划" → "创建计划 →" CTA → /profile#study-plan.
 *
 * Dumb by contract: 不 fetch / 不写 store; props 接数据 + onCreatePlan / onClickTask
 * callback. caller 处理路由 + patchStudyTask mutation.
 */

import type { StudyPlanResponse } from '@sikao/domain/dashboard/useHomeData';
import { DASHBOARD_COPY } from '@/lib/ui-copy';

export interface HomeTodayPlanBlockProps {
  /** 今日 plan, null 表示无 plan (未配置 study habit). */
  readonly plan: StudyPlanResponse | null;
  /** 跳学习计划详情; caller 处理路由 (e.g. /plan). */
  readonly onGoToPlan: () => void;
  /** Empty 态创建 plan; caller 跳 /profile#study-plan. */
  readonly onCreatePlan: () => void;
}

export function HomeTodayPlanBlock({
  plan,
  onGoToPlan,
  onCreatePlan,
}: HomeTodayPlanBlockProps) {
  // Empty 态: 今日无计划 (未配置 study habit), 引导去 Profile
  if (plan == null) {
    return (
      <section
        className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3 shadow-card min-h-[150px]"
        data-testid="home-today-plan-block"
      >
        <header className="flex items-baseline justify-between pb-3 border-b border-line">
          <h4 className="font-serif text-h-card font-medium m-0">今日计划</h4>
          <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
            02 / 04
          </span>
        </header>
        <p className="text-sm text-ink-3 leading-relaxed flex-1">
          {DASHBOARD_COPY.todayPlanEmpty}。{DASHBOARD_COPY.todayPlanEmptyHint}。
        </p>
        <button
          type="button"
          onClick={onCreatePlan}
          className="self-start rounded-tiny bg-surface text-ink border border-ink px-3 py-2 text-sm font-medium hover:bg-ink hover:text-white transition-colors duration-fast"
          data-testid="home-today-plan-create"
        >
          创建计划 →
        </button>
      </section>
    );
  }

  // Happy 态: 有 plan
  const tasks = plan.tasks;
  const doneCount = tasks.filter((t) => t.status === 'completed').length;
  const totalCount = tasks.length;
  const accuracyTargetPct =
    plan.dailyAccuracyTarget != null
      ? Math.round(plan.dailyAccuracyTarget * 100)
      : null;

  // 截取前 3 task title (避免 chip 溢出)
  const visibleTasks = tasks.slice(0, 3);

  return (
    <section
      className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3 shadow-card min-h-[150px]"
      data-testid="home-today-plan-block"
    >
      <header className="flex items-baseline justify-between pb-3 border-b border-line">
        <h4 className="font-serif text-h-card font-medium m-0">今日计划</h4>
        <span
          className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase"
          data-testid="home-today-plan-progress"
        >
          {doneCount} / {totalCount} done
        </span>
      </header>

      {/* daily_quota / accuracy_target 小字 strip (Wave 8 Phase A 字段) */}
      {plan.dailyQuota != null || accuracyTargetPct != null ? (
        <p
          className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase"
          data-testid="home-today-plan-quota"
        >
          {plan.dailyQuota != null ? `每日 ${plan.dailyQuota} 题` : null}
          {plan.dailyQuota != null && accuracyTargetPct != null ? ' · ' : null}
          {accuracyTargetPct != null
            ? `${DASHBOARD_COPY.todayPlanAccuracyLabel} ${accuracyTargetPct}%`
            : null}
        </p>
      ) : null}

      {/* Task chip 列表 (最多 3 条) */}
      <ul
        className="flex flex-col gap-2 flex-1"
        data-testid="home-today-plan-tasks"
      >
        {visibleTasks.map((task) => {
          const isDone = task.status === 'completed';
          return (
            <li
              key={task.id}
              className="flex items-center gap-2 min-w-0"
              data-testid={`home-today-plan-task-${task.id}`}
            >
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-pill shrink-0 ${
                  isDone ? 'bg-ink' : 'bg-paper-3 border border-line-3'
                }`}
                data-pattern="dot"
              />
              <span
                className={`font-serif text-sm truncate ${
                  isDone ? 'line-through text-ink-3' : 'text-ink'
                }`}
              >
                {task.payload.title}
              </span>
            </li>
          );
        })}
        {tasks.length > 3 ? (
          <li className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
            +{tasks.length - 3} more
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={onGoToPlan}
        className="self-start rounded-tiny bg-ink text-paper px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity duration-fast"
        data-testid="home-today-plan-go"
      >
        查看计划 →
      </button>
    </section>
  );
}
