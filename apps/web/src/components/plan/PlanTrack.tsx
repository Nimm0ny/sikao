/**
 * SIKAO Wave 3 PR0 · 07 hifi PlanTrack (sikao-redesign plan §0.4).
 *
 * Hifi spec (line 1068-1083, 3315-3326):
 *   - .plan-track 周容器, margin-top var(--sp-5)
 *   - .week 标签 (font-serif 24px 500) + .sub (mono 11px ink-3 uppercase tracking .12em
 *     "May 5 — May 11" 日期范围)
 *   - .days grid 7 列 + gap 8px
 *
 * 整周由 days[] map 渲 PlanDay × 7. weekNum + range 副标 + 7 day grid.
 */
import type { ReactElement } from 'react';
import { PlanDay, type PlanDayProps } from './PlanDay';

export interface PlanTrackProps {
  readonly weekNum: number;
  /** Localized date range, e.g. "May 5 — May 11". */
  readonly dateRangeLabel: string;
  readonly days: readonly PlanDayProps[];
}

export function PlanTrack({
  weekNum,
  dateRangeLabel,
  days,
}: PlanTrackProps): ReactElement {
  return (
    <div
      data-testid="plan-track"
      data-week={weekNum}
      className="mt-[var(--sp-5)] pt-[var(--sp-5)]"
    >
      <div className="mb-[var(--sp-5)]">
        <span
          className="font-serif font-medium text-2xl text-[color:var(--ink-1)]"
          data-testid="plan-track-week-num"
        >
          第 {weekNum} 周
        </span>
        <span
          className="block font-mono text-tiny uppercase tracking-wider mt-1 text-[color:var(--ink-3)]"
          data-testid="plan-track-week-range"
        >
          {dateRangeLabel}
        </span>
      </div>
      <div
        className="grid grid-cols-7 gap-2"
        data-testid="plan-track-days"
      >
        {days.map((day) => (
          <PlanDay key={day.date} {...day} />
        ))}
      </div>
    </div>
  );
}
