/**
 * SIKAO Wave 3 PR0 · 07 hifi PlanDay (sikao-redesign plan §0.4).
 *
 * Hifi spec (line 1077-1083): .plan-day
 *   - border 1px rule + padding 12px + min-h 110px + bg paper
 *   - .d: 11px mono ink-3 ("M · 5")
 *   - .item: 12px ink-2 + bg paper-2 + 2px ink left-border + padding 4-6px
 *   - .item.acc: left-border → accent
 *   - .done: bg paper-2 + .d::after " ✓" (ok color)
 *   - .today: 2px ink border (取代 1px)
 *
 * status 三/四态 (CLAUDE.md frontend/CLAUDE.md §3.5 SRP):
 *   - 'done': 绿勾 ✓ 灰色调
 *   - 'today': 加粗 ink 边
 *   - 'future': default
 *   - 'missed': 过去未完成 — 设计稿未画, PR0 不实现, 保留 type
 *
 * onTaskClick: 单 task 点击触发 (Plan view 内 routing). 整 day 卡不可点 (天 != task,
 * 天可能含多 task, 整卡点击不合适, 走 task level).
 */
import type { ReactElement } from 'react';
import { cn } from '@sikao/shared-utils';

export type DayStatus = 'done' | 'today' | 'future' | 'missed';

/** PlanDayTask: PlanDay 接受的 task subset (Plan view 内 mapper 把 BE
 * StudyTaskResponse → 此 view-model). 只保留 PR0 需要的字段, 不依赖 BE schema. */
export interface PlanDayTask {
  readonly id: string;
  readonly title: string;
  /** 'acc' 时左边 accent border (设计稿: 当天主任务高亮). */
  readonly tone: 'normal' | 'acc';
  /** 是否可点 (completed task / rest day item 不可点). */
  readonly clickable: boolean;
}

export interface PlanDayProps {
  readonly dayLabel: string;
  /** ISO date for stable test id + key. */
  readonly date: string;
  readonly status: DayStatus;
  readonly tasks: readonly PlanDayTask[];
  readonly onTaskClick?: (taskId: string) => void;
}

export function PlanDay({
  dayLabel,
  date,
  status,
  tasks,
  onTaskClick,
}: PlanDayProps): ReactElement {
  const isDone = status === 'done';
  const isToday = status === 'today';
  const isMissed = status === 'missed';

  return (
    <div
      data-testid="plan-day"
      data-date={date}
      data-status={status}
      className={cn(
        'flex flex-col gap-2 min-h-[110px] p-3 border',
        // hifi .plan-day border 1px rule, paper bg
        'border-[color:var(--line-2)]',
        isDone || isMissed
          ? 'bg-[color:var(--paper-2)]'
          : 'bg-[color:var(--paper-1)]',
        // today: 2px ink border (设计稿 1077-1083 row 1083)
        isToday && 'border-2 border-[color:var(--ink-1)]',
      )}
    >
      <div
        data-testid="plan-day-label"
        className={cn(
          'font-mono text-tiny text-[color:var(--ink-3)] tracking-eyebrow',
          isMissed && 'text-[color:var(--ink-3)]/70',
        )}
      >
        {dayLabel}
        {isDone ? (
          <span
            aria-hidden="true"
            className="ml-1 text-[color:var(--ok)]"
            data-testid="plan-day-done-mark"
          >
            ✓
          </span>
        ) : null}
      </div>
      {tasks.map((task) => (
        <PlanItem
          key={task.id}
          task={task}
          onClick={onTaskClick}
        />
      ))}
    </div>
  );
}

interface PlanItemProps {
  readonly task: PlanDayTask;
  readonly onClick?: (taskId: string) => void;
}

function PlanItem({ task, onClick }: PlanItemProps): ReactElement {
  const { id, title, tone, clickable } = task;
  // hifi spec line 1079-1080: .item.acc 左 border 色 → accent. 不动 bg / text.
  const accentBorder = tone === 'acc'
    ? 'border-l-[color:var(--accent-1)]'
    : 'border-l-[color:var(--ink-1)]';

  if (!clickable || onClick == null) {
    return (
      <div
        data-testid={`plan-item-${id}`}
        data-tone={tone}
        className={cn(
          'text-xs px-2 py-1 bg-[color:var(--paper-2)] text-[color:var(--ink-2)]',
          'border-l-2',
          accentBorder,
        )}
      >
        {title}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid={`plan-item-${id}`}
      data-tone={tone}
      onClick={() => onClick(id)}
      className={cn(
        'text-xs px-2 py-1 bg-[color:var(--paper-2)] text-[color:var(--ink-2)]',
        'border-l-2 text-left cursor-pointer',
        'hover:bg-[color:var(--paper-3)] hover:text-[color:var(--ink-1)]',
        'transition-colors duration-fast',
        accentBorder,
      )}
    >
      {title}
    </button>
  );
}
