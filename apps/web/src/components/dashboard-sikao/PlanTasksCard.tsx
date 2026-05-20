import type { StudyPlanResponse } from '@sikao/api-client/types/study-plan';
import { DASHBOARD_COPY } from '@/lib/ui-copy';

/**
 * SIKAO Dashboard 02 hifi (2026-05-11 Wave 1) — `.card-1920` 本周计划 落地.
 *
 * task 列表 (5 row), 每行: check (打勾圆点) + 标题 + 副标 + chip 状态.
 * done 行 = ink 实心 check + 删除线标题; pending 行 = 空圆点; "↑ next" = acc chip.
 *
 * 数据约定: 接 StudyPlanResponse tasks. 真本周聚合 (跨 6 天) 后端暂未提供 →
 * 当前仅显今日 plan tasks (caller 传 studyPlan.data). 设计稿 5 行 → 这里前 5 task.
 * TODO(2026-05-11 lhr): connect to `/study-plan/week` when BE 提供.
 */

const WEEKDAY_FMT = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' });

function formatTaskMeta(plan: StudyPlanResponse, taskId: number): string {
  // 当前 plan 是 today, 全部 task 显 "TODAY · 计划 X min" 或对 done task 显完成态.
  // BE schema 暂无 plannedMinutes 字段; "计划 30 min" 是 UI fallback.
  const [y, m, d] = plan.planDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const wd = WEEKDAY_FMT.format(dateObj).replace('周', '').toUpperCase();
  // hifi 例 "MON · 35 min · 92%" — done; "FRI · 计划 45 min" — pending
  const task = plan.tasks.find((t) => t.id === taskId);
  if (task == null) return wd;
  if (task.status === 'completed') {
    return `${wd} · 已完成`;
  }
  return `${wd} · 待开始`;
}

export interface PlanTasksCardProps {
  readonly plan: StudyPlanResponse;
  readonly onClickTask: (task: StudyPlanResponse['tasks'][number]) => void;
  readonly onCompleteTask: (taskId: number) => void;
  readonly isPatchingTaskId: number | null;
}

export function PlanTasksCard({
  plan,
  onClickTask,
  onCompleteTask,
  isPatchingTaskId,
}: PlanTasksCardProps) {
  const tasks = plan.tasks.slice(0, 5);
  const doneCount = plan.tasks.filter((t) => t.status === 'completed').length;
  const totalCount = plan.tasks.length;

  return (
    <section
      className="rounded-card border border-line bg-surface p-6 flex flex-col gap-4 shadow-card"
      data-testid="dashboard-plan-tasks"
    >
      <header className="flex items-baseline justify-between pb-3 border-b border-line">
        <h4 className="font-serif text-lg font-medium m-0">本周计划</h4>
        <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
          {doneCount} / {totalCount} done
        </span>
      </header>

      {tasks.length === 0 ? (
        <p className="text-sm text-ink-3 py-4">{DASHBOARD_COPY.planTasksEmpty}.</p>
      ) : (
        <ul className="flex flex-col" data-testid="dashboard-plan-tasks-list">
          {tasks.map((task) => {
            const isDone = task.status === 'completed';
            const isNext = !isDone && task.status === 'pending';
            const isPatching = isPatchingTaskId === task.id;
            return (
              <li
                key={task.id}
                className="grid grid-cols-[24px_1fr_auto] gap-3 py-3 border-b border-line last:border-b-0 items-center"
              >
                <button
                  type="button"
                  aria-label={isDone ? '取消完成' : '标记完成'}
                  disabled={isPatching}
                  onClick={() => onCompleteTask(task.id)}
                  data-testid={`dashboard-plan-task-check-${task.id}`}
                  className={`w-4 h-4 rounded-pill grid place-items-center text-tiny font-mono shrink-0 transition-colors duration-fast ${
                    isDone
                      ? 'bg-ink text-paper border border-ink'
                      : 'bg-transparent text-ink-3 border border-ink-3 hover:border-ink hover:text-ink'
                  }`}
                  data-pattern="dot"
                >
                  {isDone ? '✓' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => onClickTask(task)}
                  className="text-left min-w-0 hover:opacity-80 transition-opacity duration-fast"
                  data-testid={`dashboard-plan-task-row-${task.id}`}
                >
                  <div
                    className={`font-serif text-sm font-medium truncate ${
                      isDone ? 'line-through text-ink-3' : 'text-ink'
                    }`}
                  >
                    {task.payload.title}
                  </div>
                  <div className="font-mono text-tiny text-ink-3 tracking-eyebrow mt-1 uppercase">
                    {formatTaskMeta(plan, task.id)}
                  </div>
                </button>
                <span
                  className={`font-mono text-tiny tracking-wider uppercase px-2 py-1 border ${
                    isDone
                      ? 'bg-ok-bg text-ok border-ok'
                      : isNext
                        ? 'text-accent border-accent'
                        : 'text-ink-3 border-line'
                  }`}
                  style={{ borderRadius: 'var(--r-1)' }}
                >
                  {isDone ? '完成' : isNext ? '↑ next' : '待开始'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
