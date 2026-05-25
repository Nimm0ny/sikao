// lint-allow-ui-copy: V5 ProfileLearning PlanSlice copy.
import { Panel } from '../../components/layout';
import type { DashboardProgressResponseV2 } from '@sikao/api-client/types/home';
import styles from './PlanSlice.module.css';

/*
 * PlanSlice — current plan window snapshot.
 *
 * Why: shows the user's progress against their active plan window:
 *      events done / total, minutes practiced vs target, completion
 *      ratio rendered as a horizontal progress bar.
 *
 *      AGENT-H7: completionRate guarded — when target window is 0 (no
 *      active plan) or events total is 0, we render 0% rather than
 *      dividing by zero.
 */

interface PlanSliceProps {
  readonly overview: DashboardProgressResponseV2;
}

function safeRatio(numer: number, denom: number): number {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return 0;
  const ratio = numer / denom;
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(1, Math.max(0, ratio));
}

export function PlanSlice({ overview }: PlanSliceProps) {
  const slice = overview.summary.planSlice;
  const completion = safeRatio(slice.eventsDone, slice.eventsInWindowTotal);
  const completionPct = Math.round(completion * 100);
  const minutesPct = Math.round(safeRatio(slice.minutesPracticedInWindow, slice.minutesTargetInWindow) * 100);

  const windowMeta = slice.rangeFrom && slice.rangeTo
    ? `${slice.rangeFrom} – ${slice.rangeTo}`
    : '当前计划窗口';

  return (
    <Panel title="计划窗口完成度">
      <div className={styles.root} data-testid="profile-learning-plan-slice">
        <span className={styles.windowMeta}>{windowMeta}</span>
        <div
          className={styles.progress}
          role="progressbar"
          aria-valuenow={completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="计划事件完成度"
        >
          <div className={styles.progressFill} style={{ width: `${completionPct}%` }} />
        </div>
        <div className={styles.metrics}>
          <div className={styles.cell}>
            <span className={styles.cellValue}>{slice.eventsDone}/{slice.eventsInWindowTotal}</span>
            <span className={styles.cellLabel}>事件完成</span>
          </div>
          <div className={styles.cell}>
            <span className={styles.cellValue}>{slice.minutesPracticedInWindow}<small>min</small></span>
            <span className={styles.cellLabel}>已练习 · 目标 {slice.minutesTargetInWindow}min · {minutesPct}%</span>
          </div>
          <div className={styles.cell}>
            <span className={styles.cellValue}>{slice.eventsSkipped}</span>
            <span className={styles.cellLabel}>已跳过</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
