import { Card } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import type { HeatmapEntryV2 } from '@sikao/api-client/types/api';

/*
 * 本周 7 天横向 strip 日历, 跟 HeatmapChart "近 53 周" 错位分工:
 *   - 本组件: 关注 "本周节奏" 视角 (Dashboard 顶部 hero), 摘要 + 今日强调
 *   - HeatmapChart: "近 53 周" 长期记录视角, 独立区块保留
 *
 * 调用方契约:
 *   - entries 长度严格 = 7 (Fail-Fast, 调用方负责 slice 后 7 天)
 *   - entries 按 date asc 排序 (相信调用方, 本组件不重排)
 *   - 今日列 = entries[6] (即最后一天). 若 entries[6].date === 本地 today,
 *     在该列 block 加 outline 强调; 不强行 today 必须落在 [6], 允许"今天还没数据"
 *     场景 (entries[6] 是昨天) 时不强调任何列.
 *
 * 视觉行为:
 *   - 横向 7 列, 每列 = 周几字符 (上) + 方块 (下)
 *   - 方块 24-28px squarish, color encoding 跟 HeatmapChart 一致 (5 档 ramp)
 *   - 摘要: "本周练习 N 题 · X 天有练习" (数字 tabular-nums)
 *   - 今日列 outline 强调 (accent 描边)
 *   - 无动画, 无 tooltip / popover
 */

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

const EXPECTED_LENGTH = 7;

// 跟 HeatmapChart cellToneClass 1:1 一致, 保证两个组件视觉无冲突 ramp.
function cellToneClass(count: number): string {
  if (count === 0) return 'bg-surface-alt border-line';
  if (count <= 5) return 'bg-paper-3 border-line-3';
  if (count <= 10) return 'bg-line-3 border-line-3';
  if (count <= 20) return 'bg-ink-3 border-ink-3';
  return 'bg-ink border-ink';
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function totalQuestions(entries: readonly HeatmapEntryV2[]): number {
  let sum = 0;
  for (const e of entries) sum += e.count;
  return sum;
}

function practicedDays(entries: readonly HeatmapEntryV2[]): number {
  let n = 0;
  for (const e of entries) if (e.count > 0) n += 1;
  return n;
}

export interface WeekStripCalendarProps {
  readonly entries: readonly HeatmapEntryV2[];
  readonly className?: string;
}

export function WeekStripCalendar({ entries, className }: WeekStripCalendarProps) {
  if (entries.length !== EXPECTED_LENGTH) {
    throw new Error(
      `WeekStripCalendar: entries.length must be exactly ${EXPECTED_LENGTH}, got ${entries.length}`,
    );
  }

  const total = totalQuestions(entries);
  const days = practicedDays(entries);
  const today = todayISO();

  return (
    <Card
      as="section"
      padding="sm"
      className={cn('', className)}
      data-testid="week-strip-calendar"
      aria-label="本周练习节奏"
    >
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-ink">本周节奏</h3>
        <span className="text-tiny font-mono text-ink-4 tracking-wide">
          近 7 天
        </span>
      </header>
      <div className="flex gap-2" data-testid="week-strip-grid">
        {entries.map((entry, idx) => {
          const isToday = entry.date === today;
          return (
            <div
              key={entry.date}
              className="flex flex-col items-center gap-2 flex-1 min-w-0"
              data-testid={`week-strip-col-${idx}`}
              data-date={entry.date}
              data-today={isToday ? 'true' : 'false'}
            >
              <span className="text-tiny font-mono text-ink-3 tracking-wider">
                {WEEKDAY_LABELS[idx]}
              </span>
              <span
                aria-label={`${entry.date} · ${entry.count} 题 · 正确率 ${Math.round(entry.rate * 100)}%`}
                data-testid={`week-strip-cell-${idx}`}
                className={cn(
                  'w-7 h-7 border rounded-1',
                  cellToneClass(entry.count),
                  isToday && 'outline outline-2 outline-accent outline-offset-2',
                )}
              />
            </div>
          );
        })}
      </div>
      <p
        className="mt-3 text-sm text-ink-3"
        data-testid="week-strip-summary"
      >
        本周练习{' '}
        <span className="font-mono tabular-nums text-ink font-semibold">{total}</span>
        {' '}题 ·{' '}
        <span className="font-mono tabular-nums text-ink font-semibold">{days}</span>
        {' '}天有练习
      </p>
    </Card>
  );
}
