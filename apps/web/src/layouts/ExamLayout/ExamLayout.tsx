import type { ReactNode } from 'react';
import styles from './ExamLayout.module.css';

/*
 * ExamLayout — V5 §D.4.6 layout container (skeleton).
 *
 * Why: exam pages are a SaaS-shell EXCEPTION. design.md §D.4.6 + §D.3.35
 *      gotcha forbid wrapping AppShell / Rail around exam content — the
 *      exam owns the entire viewport via its own ExamTopBar + 2-pane
 *      PanelGroup + Sheet (草稿纸). This skeleton reserves the 4 slots so
 *      page authors compose intent without inviting the desktop chrome.
 *
 *      Token contract per §4.7:
 *        --exam-pane-padding      → padding around each Panel body
 *        --exam-divider-handle-w  → ResizeHandle width
 *        --exam-topbar-h          → ExamTopBar height (= --topbar-h)
 *
 *      Resize/drag interactions, timer state and Sheet z-stacking ship
 *      with the dedicated Exam interaction spec (R1/Q5 + R2/Q6). This
 *      skeleton is purely structural.
 */

export interface ExamLayoutProps {
  readonly topbar: ReactNode;
  readonly leftPane: ReactNode;
  readonly rightPane: ReactNode;
  readonly sheet?: ReactNode;
  readonly 'aria-label'?: string;
}

export function ExamLayout({
  topbar,
  leftPane,
  rightPane,
  sheet,
  'aria-label': ariaLabel = '考试',
}: ExamLayoutProps) {
  return (
    <div
      className={styles.root}
      data-testid="exam-layout"
      role="region"
      aria-label={ariaLabel}
    >
      <header className={styles.topbar} data-testid="exam-layout-topbar">
        {topbar}
      </header>
      <div
        className={styles.panelGroup}
        data-direction="horizontal"
        data-testid="exam-layout-panel-group"
      >
        <section className={styles.pane} data-testid="exam-layout-left-pane">
          {leftPane}
        </section>
        <div
          className={styles.resizeHandle}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整左右面板宽度"
          data-testid="exam-layout-resize-handle"
        />
        <section className={styles.pane} data-testid="exam-layout-right-pane">
          {rightPane}
        </section>
      </div>
      {sheet !== undefined ? (
        <div className={styles.sheetSlot} data-testid="exam-layout-sheet">
          {sheet}
        </div>
      ) : null}
    </div>
  );
}
