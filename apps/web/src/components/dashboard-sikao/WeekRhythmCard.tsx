import type { HeatmapEntryV2 } from '@sikao/api-client/types/api';

/**
 * SIKAO Dashboard 02 hifi (2026-05-11 Wave 1) — `.card-1920` 本周节奏 落地.
 *
 * 7 day strip M-S, 每日显小时分钟. 今日 (.tdy) 加 ink 描边 + 略深底.
 * 周末无数据 (.rest) 浅灰底 + dash.
 *
 * 数据约定: 接最近 7 天 heatmap entries. caller 自切片 (e.g. weekEntries =
 * heatmap.slice(-7)). 不足 7 天 caller 自决定是否 mount.
 */

const DAY_FMT = new Intl.DateTimeFormat('zh-CN', { day: 'numeric' });

// 周日 / 周六 视为休息日 (rest 浅底). 工作日有 entry.count > 0 显时长, 无显 "·".
// hifi 设计稿用 M T W T F S S 单字母, 直接 hardcode 让 zh-CN Intl 不绕路.
function dayKey(date: Date, isToday: boolean): string {
  const map = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const letter = map[date.getDay()];
  const dayN = DAY_FMT.format(date).replace('日', '');
  return isToday ? `${letter} · 今天` : `${letter} · ${dayN}`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '·';
  if (minutes < 60) return `${minutes}′`;
  const h = Math.floor(minutes / 60);
  const m = minutes - h * 60;
  if (m === 0) return `${h}h`;
  return `${h}h${m}′`;
}

export interface WeekRhythmCardProps {
  /** 7 个 entry, 按时间顺序 (旧 → 新, 末位最新). */
  readonly entries: readonly HeatmapEntryV2[];
  /** 本周总时长 (h). 缺值显 "—". */
  readonly weekTotalHours: number | null;
  /** vs 上周 delta (h). 正 → "+Xh", 负 → "-Xh", 缺值不显. */
  readonly weekDeltaHours: number | null;
}

// minutes 推算: BE heatmap entry.count = 答题数, 不是分钟. 这里映射规则:
// SIKAO hifi 设计稿口径里 count = 35min 等, 但 entry.count 是题数. 用 "题 × 1.5min"
// 粗估展示 — 这是 UI fallback, 真值待 BE 加 minutes 字段 (TODO 2026-05-11).
const MIN_PER_ANSWER_ESTIMATE = 1.5;

export function WeekRhythmCard({
  entries,
  weekTotalHours,
  weekDeltaHours,
}: WeekRhythmCardProps) {
  const today = new Date();
  const todayDateStr = today.toISOString().slice(0, 10);

  // entries 兜 7 条; caller 应保 7 条, 这里防御性 slice.
  const week = entries.slice(-7);

  return (
    <section
      className="rounded-card border border-line bg-surface p-6 flex flex-col gap-4 shadow-card"
      data-testid="dashboard-week-rhythm"
    >
      <header className="flex items-baseline justify-between pb-3 border-b border-line">
        <h4 className="font-serif text-lg font-medium m-0">本周节奏</h4>
        <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
          {weekTotalHours != null ? (
            <>
              {weekTotalHours.toFixed(1)}h
              {weekDeltaHours != null ? (
                <>
                  {' · '}
                  {weekDeltaHours >= 0 ? '+' : ''}
                  {weekDeltaHours.toFixed(1)}h vs W-1
                </>
              ) : null}
            </>
          ) : (
            <>—</>
          )}
        </span>
      </header>

      <div className="grid grid-cols-7 gap-2">
        {week.map((e) => {
          const dateObj = new Date(e.date);
          const isToday = e.date === todayDateStr;
          const dayOfWeek = dateObj.getDay();
          // TODO(2026-05-11 lhr): BE 暂无 user rest day schedule; 现按周末 + 0 题视为 rest,
          // 接 /study-plan/week 拿 user.restDays 字段后切真值.
          const isRest = (dayOfWeek === 0 || dayOfWeek === 6) && e.count === 0;
          const minutes = Math.round(e.count * MIN_PER_ANSWER_ESTIMATE);
          // hifi `.week-1920 .d`: aspect-ratio 0.9, p 10 8, grid align
          // space-between. tdy = ink 2px border + paper-2 bg. rest = paper-3 + ink-3 text.
          const stateCls = isToday
            ? 'border-ink bg-surface-alt'
            : isRest
              ? 'bg-paper-3 text-ink-3 border-line'
              : 'border-line bg-surface';
          return (
            <div
              key={e.date}
              className={`border ${stateCls} p-2 grid content-between rounded-1`}
              style={{
                aspectRatio: '0.9',
                borderWidth: isToday ? '2px' : '1px',
              }}
              data-testid={`dashboard-week-day-${e.date}`}
            >
              <div className="font-mono text-tiny text-ink-3 uppercase">
                {dayKey(dateObj, isToday)}
              </div>
              <div className="font-serif text-lg font-medium">
                {formatDuration(minutes)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
