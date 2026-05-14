// Pure view-model helpers for views/Plan.tsx — extracted to keep
// Plan.tsx ≤ 500 行 (frontend/CLAUDE.md §3.5). 没有 React 依赖, 全
// pure functions + 类型 + 常量; 测试覆盖通过 Plan view E2E / future
// Plan.test.tsx 间接验证.
//
// SIKAO Wave 2/3 polish (2026-05-11): 拆分自 Plan.tsx, 不改算法.

import type { PlanDayProps, PlanTrackProps, DayStatus } from '@/components/plan';
import type {
  StudyPlanResponse,
  StudyPlanHistoryItemV2,
} from '@sikao/api-client/types/study-plan';

// 周显示规则: today + 过去 4 周 + 未来 0 周 (PR0 不预测未来; future 周从 history
// slim 拉到再渲, 滚到底 fetchNextPage 加载更多). 一次最多渲 5 周连续.

export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

// ── helpers (date / week math, 走原生 Date 不引入 dayjs / date-fns) ───────────

export function parseISODate(iso: string): Date {
  // 'YYYY-MM-DD' → 本地 0:00 (跟 StudyPlanHistoryItem.tsx formatDate 同模式 —
  // 加 'T00:00:00' 让所有时区用户看同一日历日, 不漂时区).
  return new Date(`${iso}T00:00:00`);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get Monday of the week for a given date (本地周 = ISO 周, Mon-Sun). */
export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  // JS getDay: Sun=0..Sat=6; 转成 Mon=0..Sun=6
  const dow = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - dow);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

const MONTH_DAY_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

export function formatWeekRange(start: Date, end: Date): string {
  return `${MONTH_DAY_FMT.format(start)} — ${MONTH_DAY_FMT.format(end)}`;
}

/** Compute ISO week number 1-based from start of year.
 * 简化: 距 Jan 1 的天数 / 7 + 1, cap [1, 53]. 不严格 ISO 8601 (跨年 week 可能差 1)
 * — PR0 hifi 只需稳定的"第 N 周"显示, 1 周差不影响视觉. */
export function isoWeekNumber(d: Date): number {
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - yearStart.getTime();
  return Math.max(1, Math.min(53, Math.ceil((diff / 86_400_000 + 1) / 7)));
}

// ── view-model build ────────────────────────────────────────────────────────

export interface DayViewModel {
  readonly date: string;
  readonly dayLabel: string;
  readonly status: DayStatus;
  readonly tasks: PlanDayProps['tasks'];
}

export interface WeekViewModel extends Omit<PlanTrackProps, 'days'> {
  readonly days: readonly DayViewModel[];
  readonly weekStartDate: string;
}

/**
 * 把 today (single full plan) + history slim items 聚合成"按周分组的 weeks"数组.
 * 规则:
 *   - 取 today 周作 anchor week
 *   - 历史 history.items 按 plan_date 降序到 anchor 周; 每条算属哪周 → 该周 days[date].tasks
 *   - day.status: < today 且无 history hit → 'missed'; today 当天 → 'today'; > today
 *     未来无 history → 'future'; 有 history hit + plan_date < today → 'done'
 *   - history slim 仅含 taskCompleted / taskTotal 两数, 没具体 task 列表 → 用聚合
 *     count 渲 1 条 "X / Y 完成" 摘要 task; today 周用 today plan.tasks 完整列表
 *
 * weeks 数组按周倒序 (今 → 过去), 每周渲 7 day grid.
 */
export function buildWeeks(
  today: StudyPlanResponse | undefined,
  historyItems: readonly StudyPlanHistoryItemV2[],
  todayDate: Date,
): readonly WeekViewModel[] {
  const todayISO = toISODate(todayDate);
  const todayWeekStart = startOfWeek(todayDate);

  // 把 history slim 按 plan_date 入 map (key=ISO date)
  const historyByDate = new Map<string, StudyPlanHistoryItemV2>();
  for (const item of historyItems) {
    historyByDate.set(item.planDate, item);
  }

  // 收集所有出现的 weekStart (today 周 + history 涉及周)
  const weekStartSet = new Set<string>();
  weekStartSet.add(toISODate(todayWeekStart));
  for (const item of historyItems) {
    const ws = startOfWeek(parseISODate(item.planDate));
    weekStartSet.add(toISODate(ws));
  }

  // 倒序 (新 → 老)
  const weekStarts = Array.from(weekStartSet)
    .sort()
    .reverse()
    .map((iso) => parseISODate(iso));

  return weekStarts.map((weekStart): WeekViewModel => {
    const weekEnd = addDays(weekStart, 6);
    const days: DayViewModel[] = [];
    for (let i = 0; i < 7; i += 1) {
      const dayDate = addDays(weekStart, i);
      const dayISO = toISODate(dayDate);
      const isToday = dayISO === todayISO;
      const isPast = dayISO < todayISO;

      // 当天数据源:
      //   - today plan: 用 plan.tasks 完整列表 (跟 hifi day 多 task 列对齐)
      //   - 历史 history.items hit: 用聚合摘要 1 条
      //   - 都没有: 'missed' (过去) / 'future'
      let status: DayStatus = 'future';
      let tasks: DayViewModel['tasks'] = [];

      if (isToday && today != null) {
        status = 'today';
        tasks = mapTodayPlanToItems(today);
      } else if (historyByDate.has(dayISO)) {
        const hi = historyByDate.get(dayISO);
        if (hi !== undefined) {
          // plan_date 在 today 之前 → done; 等于 today → today (前面分支已挡)
          status = 'done';
          tasks = [
            {
              id: `summary-${hi.id}`,
              title: `${hi.taskCompleted} / ${hi.taskTotal} 完成`,
              tone: 'normal',
              clickable: false,
            },
          ];
        }
      } else if (isPast) {
        status = 'missed';
        tasks = [
          { id: `rest-${dayISO}`, title: '休息', tone: 'normal', clickable: false },
        ];
      }

      days.push({
        date: dayISO,
        dayLabel: `${WEEKDAY_SHORT[dayDate.getDay()]} · ${dayDate.getDate()}${isToday ? ' 今天' : ''}`,
        status,
        tasks,
      });
    }

    return {
      weekNum: isoWeekNumber(weekStart),
      dateRangeLabel: formatWeekRange(weekStart, weekEnd),
      weekStartDate: toISODate(weekStart),
      days,
    };
  });
}

export function mapTodayPlanToItems(plan: StudyPlanResponse): PlanDayProps['tasks'] {
  // 今日 task list → PlanDayTask. accent 第 1 条 (跟 hifi mock 当天 .item.acc 高亮
  // 主任务一致 — "F · 9 今天 资料·基期还原" 用 acc), 其他 normal.
  return plan.tasks.map((task, idx) => ({
    id: String(task.id),
    title: task.payload.title,
    tone: idx === 0 && task.status !== 'completed' ? ('acc' as const) : ('normal' as const),
    clickable: task.status !== 'completed',
  }));
}

// ── PlanAssistant fallback (PR0 硬编码) ─────────────────────────────────────

export function pickAssistantNarrative(today: StudyPlanResponse | undefined): string {
  if (today == null || today.tasks.length === 0) {
    return '今天没安排具体任务，给自己一段空白时间，回看一下上周三道错的题吧。';
  }
  const completed = today.tasks.filter((t) => t.status === 'completed').length;
  const total = today.tasks.length;
  if (completed === 0) {
    return `今天有 ${total} 个任务在等你。一道题、一段笔记、一次复盘 — 哪个都行，关键是开始。`;
  }
  if (completed < total) {
    return `今天已完成 ${completed} / ${total} 任务。最后这几个就在你的节奏里，没什么需要赶。`;
  }
  return '今天的计划已全部完成。剩下的时间留给自己 — 看看明天的安排，或者只是合上电脑，去散个步。';
}
