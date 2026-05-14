/**
 * SIKAO Wave 3 PR0 · 07 hifi PlanHead (sikao-redesign plan §0.4).
 *
 * Hifi spec (line 3303-3313): `.plan-head` grid 2 列 1fr/auto align-end.
 *   - 左 col: eyebrow + h1 (44px serif 500 -.02em letter-spacing) + subtitle 14px ink-3
 *   - 右 col: countdown 纵列, n 56px serif mono 500 -.03em, l 11px mono uppercase eyebrow
 *
 * 文案规则:
 *   - eyebrow: "2026 国考 · WEEK N OF M" (M=24 总周数, hifi mock 14/24, 已实 M= ceil(daysUntilExam/7) cap 至少 1)
 *   - h1: "距 {examLabel}还有 N 天。" — Wave 5C P2-1: 拼 examLabel + days,
 *     跟 Login subtitle "距 ${examLabel}还有 ${daysUntil} 天。" 一致
 *     (从 examDateLabel "11 月 24 日" 切到 examLabel "2026 国考" — 信息密度更高,
 *     避免用户在 Plan/Login 看到不同颗粒度的倒计时锚点)
 *   - subtitle: "本周 X / 7 天已完成。本月累计 Y 小时 Z 分钟。" hardcode "暂未接 BE" 兜底 (PR1 接学情)
 *   - countdown.n = days
 *   - countdown.l = "DAYS · M WEEKS"
 *
 * Defensive: days < 0 时整个 head 仍渲, h1 改"考试已过, 看看下次目标。", countdown 仍显
 * |days| 但 hidden via aria + style (PR1 接 BE 后实际不会 < 0).
 */
import type { ReactElement } from 'react';

export interface PlanHeadProps {
  readonly examLabel: string;
  /** Days until exam date (本地日历差, 跨日不漂移). */
  readonly daysUntilExam: number;
  /** Current week index 1-based (>= 1). */
  readonly currentWeekNum: number;
  /** Total weeks in plan span (cap by daysUntilExam / 7). */
  readonly totalWeekNum: number;
  /** Days completed in current week (0-7). */
  readonly weekCompletedDays: number;
  /** Cumulative practice hours in current month (estimate, BE 接入前 0). */
  readonly monthHours: number;
  /** Cumulative practice minutes remainder in current month (0-59). */
  readonly monthMinutes: number;
}

export function PlanHead(props: PlanHeadProps): ReactElement {
  const {
    examLabel,
    daysUntilExam,
    currentWeekNum,
    totalWeekNum,
    weekCompletedDays,
    monthHours,
    monthMinutes,
  } = props;
  const isPastExam = daysUntilExam < 0;
  const displayDays = Math.abs(daysUntilExam);
  const safeTotalWeeks = Math.max(totalWeekNum, currentWeekNum);

  // 文案规则: Wave 5C P2-1 — h1 用 examLabel 拼接, 跟 Login subtitle 一致.
  // 例: "距 2026 国考 (中央机关)还有 208 天。" CJK 无空格连读 (排版习惯).
  const h1Text = isPastExam
    ? '考试已结束, 看看下一次目标。'
    : `距 ${examLabel}还有 ${displayDays} 天。`;

  const subtitleText = renderSubtitle({
    weekCompletedDays,
    monthHours,
    monthMinutes,
  });

  return (
    <div
      data-testid="plan-head"
      className="grid grid-cols-[1fr_auto] items-end gap-[var(--sp-5)] mb-[var(--sp-6)] pb-[var(--sp-5)] border-b border-[color:var(--line-2)]"
    >
      <div className="min-w-0">
        <div
          className="font-mono uppercase tracking-eyebrow text-tiny text-[color:var(--ink-3)]"
          data-testid="plan-head-eyebrow"
        >
          {examLabel} · WEEK {currentWeekNum} OF {safeTotalWeeks}
        </div>
        <h1
          className="font-serif font-medium text-4xl md:text-5xl tracking-tight m-0 mt-1 text-[color:var(--ink-1)]"
          data-testid="plan-head-title"
        >
          {h1Text}
        </h1>
        <p
          className="text-sm leading-relaxed mt-2 text-[color:var(--ink-3)]"
          data-testid="plan-head-subtitle"
        >
          {subtitleText}
        </p>
      </div>
      <div
        className="text-right shrink-0"
        data-testid="plan-head-countdown"
      >
        <div
          className="font-serif font-medium text-5xl leading-none tabular-nums tracking-tight text-[color:var(--ink-1)]"
          data-testid="plan-head-countdown-n"
        >
          {displayDays}
        </div>
        <div
          className="font-mono uppercase tracking-wider text-tiny mt-1 text-[color:var(--ink-3)]"
          data-testid="plan-head-countdown-l"
        >
          days · {safeTotalWeeks} weeks
        </div>
      </div>
    </div>
  );
}

interface SubtitleInput {
  readonly weekCompletedDays: number;
  readonly monthHours: number;
  readonly monthMinutes: number;
}

function renderSubtitle({
  weekCompletedDays,
  monthHours,
  monthMinutes,
}: SubtitleInput): string {
  const weekClamped = Math.max(0, Math.min(7, weekCompletedDays));
  const hasMonthData = monthHours > 0 || monthMinutes > 0;
  // PR1 BE 接入前: monthHours / monthMinutes 上游传 0 时, 副标退化为单段周指标 —
  // 不显"累计 0 小时 0 分钟"避免给用户错印象.
  if (!hasMonthData) {
    return `本周 ${weekClamped} / 7 天已完成。`;
  }
  return `本周 ${weekClamped} / 7 天已完成。本月累计 ${monthHours} 小时 ${monthMinutes} 分钟。`;
}
