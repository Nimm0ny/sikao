import type { HeatmapEntryV2 } from '@sikao/api-client/types/api';
import { DASHBOARD_COPY } from '@/lib/ui-copy';

/**
 * SIKAO Dashboard 02 hifi (2026-05-11 Wave 1) — `.streak-1920` 落地.
 *
 * 连续打卡卡: serif 大字 ring + LAST 28 DAYS dot strip + footer 时间轴.
 *
 * Dumb: 接 streakDays / longestStreakDays / 近 28 天 heatmap entries (有则
 * dot=ink, 无则 dot=paper-3), 渲染. caller 提供数据.
 *
 * 数据约定:
 *  - streakDays: 当前连续天数 (DashboardStatsV2.currentStreakDays).
 *  - longestStreakDays: 最长记录 (BE 暂未提供 → undefined 显 "—").
 *    TODO(2026-05-11 lhr): connect to BE when summary 加 longestStreakDays
 *    字段; 当前 mock 用 currentStreakDays (不假数据).
 *  - entries: 用过去 28 天 heatmap; entry.count > 0 视为打卡; 不足 28 天补占位.
 *    今日 (entries 最后一项) 走 accent 蓝色.
 */

const DOT_COUNT = 28;

export interface StreakCardProps {
  readonly streakDays: number;
  readonly longestStreakDays: number | null;
  /** 近 28 天 (旧 → 新). 不足 28 天 caller 自补; 内部按 count > 0 判 on/off. */
  readonly entries: readonly HeatmapEntryV2[];
}

export function StreakCard({
  streakDays,
  longestStreakDays,
  entries,
}: StreakCardProps) {
  // 28 dots: 末位 = 今日 (accent), 之前 count > 0 走 ink, 否则 paper-3.
  const slots = Array.from({ length: DOT_COUNT }).map((_, i) => {
    const idx = entries.length - DOT_COUNT + i;
    const entry = idx >= 0 ? entries[idx] : null;
    const isOn = entry != null && entry.count > 0;
    const isToday = i === DOT_COUNT - 1;
    return { isOn, isToday };
  });

  // 距纪录 X 天计算: longest > current 时显; 否则 (current >= longest, 即将破记录)
  // 显当前 = 最长.
  const distance =
    longestStreakDays != null && longestStreakDays > streakDays
      ? longestStreakDays - streakDays
      : 0;
  const willBreakRecord =
    longestStreakDays != null && streakDays + 1 >= longestStreakDays;

  return (
    <section
      // hifi `.streak-1920`: bg-paper-2 (warm) + 边 rule, p 32, gap 18.
      // SIKAO 偏小圆角 (rounded-card = 6px) — paper 风不上大圆角.
      className="rounded-card border border-line bg-surface-alt p-8 flex flex-col gap-4"
      data-testid="dashboard-streak-card"
    >
      <header className="flex items-baseline justify-between">
        <h4 className="font-serif text-xl font-medium m-0">连续打卡</h4>
        <span className="font-mono text-tiny tracking-wider text-ink-3 uppercase">
          Last 28 Days
        </span>
      </header>

      <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
        <div className="font-serif font-medium tracking-tight text-ink leading-none" style={{ fontSize: 'var(--t-display)' }}>
          {streakDays}
          <small className="font-serif text-2xl text-ink-3 font-normal ml-1">
            天
          </small>
        </div>
        <div className="text-sm text-ink-3 leading-relaxed">
          {longestStreakDays != null ? (
            <>
              最长 {longestStreakDays} 天
              {distance > 0 ? <> · 距纪录 {distance} 天</> : null}
            </>
          ) : (
            <>最长 —</>
          )}
          <br />
          {willBreakRecord ? (
            <span className="font-mono text-tiny tracking-widest text-accent uppercase">
              → {DASHBOARD_COPY.streakBreakHint}
            </span>
          ) : (
            <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
              · 继续保持
            </span>
          )}
        </div>
      </div>

      {/* 28 dots. aspect-ratio 1 让 dot 正方形, w-full 自适应宽度.
          dot-pattern marker (CLAUDE.md §4 lint:radius-token 例外条件):
          每个 dot 标 data-pattern="dot", 而且尺寸来自 grid 单元格 (aspect 1) 默认
          ≤16px (28 列 / streak card 宽), 命中 lint 白名单. */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${DOT_COUNT}, 1fr)` }}
        aria-hidden="true"
      >
        {slots.map((s, i) => (
          <span
            key={i}
            data-pattern="dot"
            className={
              s.isToday
                ? 'aspect-square rounded-1 bg-accent'
                : s.isOn
                  ? 'aspect-square rounded-1 bg-ink'
                  : 'aspect-square rounded-1 bg-paper-3'
            }
          />
        ))}
      </div>

      <footer className="flex justify-between font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
        <span>4 周前</span>
        <span className="text-accent">今天</span>
      </footer>
    </section>
  );
}
