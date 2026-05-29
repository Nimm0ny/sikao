import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { FocusTrap } from '../../../../components/system/FocusTrap';
import { Button } from '../../../../components/form/Button/Button';
import type { EventConflictItemV2 } from '@sikao/api-client/types/home';
import styles from './ConflictConfirmDialog.module.css';

/*
 * ConflictConfirmDialog — SIK-139 W3.
 *
 * Why: design Decisions 1 picks a SECOND-CONFIRM dialog (not a hard block) as
 *      the landing-conflict UX. When `detectEventConflicts` returns conflicts,
 *      the drop is NOT auto-committed; this layer lists the colliding events
 *      and lets the user confirm (proceed with the reschedule) or cancel
 *      (no store write, no PATCH — the W2 commit path is never entered).
 *
 *      Reuses the SIK-138 Peek a11y recipe (portal to body + FocusTrap + Esc
 *      + focus restore + body scroll lock), but unlike the read-only Peek this
 *      is a WRITABLE confirm surface. Visual contract §4: tokens are the
 *      Peek/dialog family (--cal-peek-scrim + --shadow-l4 + --cal-peek-radius).
 *
 *      AGENT-H7: Esc / scrim / cancel all route to onCancel (clean exit, no
 *      side effect). Only the explicit confirm button calls onConfirm.
 */

// lint-allow-ui-copy: SIK-139 W3 conflict confirm copy. Drag-reschedule
// conflict layer strings; CJK visual contract per spec design §W3.
const COPY = {
  title: '落点存在冲突',
  subtitle: '该时段已有以下安排，仍要改到这一天吗？',
  cancel: '取消',
  confirm: '仍然改期',
} as const;

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Format a conflict's window for display; unparseable instants show raw. */
function formatConflictTime(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startAt} – ${endAt}`;
  }
  return `${TIME_FMT.format(start)} – ${TIME_FMT.format(end)}`;
}

export interface ConflictConfirmDialogProps {
  readonly open: boolean;
  readonly conflicts: readonly EventConflictItemV2[];
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConflictConfirmDialog({
  open,
  conflicts,
  onConfirm,
  onCancel,
}: ConflictConfirmDialogProps) {
  // Esc closes (cancel semantics). Only attached while open so a closed
  // dialog never steals global key events (mirrors CalendarPeekCard).
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  // Body scroll lock while open (mirrors the Peek / Modal pattern).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={styles.overlay}
      data-testid="home-conflict-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <FocusTrap active={open}>
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="home-conflict-title"
          aria-describedby="home-conflict-subtitle"
          className={styles.card}
          data-testid="home-conflict-dialog"
        >
          <header className={styles.head}>
            <h2 id="home-conflict-title" className={styles.title}>{COPY.title}</h2>
            <p id="home-conflict-subtitle" className={styles.subtitle}>{COPY.subtitle}</p>
          </header>
          <div className={styles.body}>
            <ul className={styles.list} data-testid="home-conflict-list">
              {conflicts.map((c) => (
                <li key={`${c.kind}:${c.sourceId}`} className={styles.item}>
                  <span className={styles.itemTitle}>{c.title}</span>
                  <span className={styles.itemTime}>{formatConflictTime(c.startAt, c.endAt)}</span>
                </li>
              ))}
            </ul>
          </div>
          <footer className={styles.footer}>
            <Button variant="secondary" onClick={onCancel}>{COPY.cancel}</Button>
            <Button variant="danger" onClick={onConfirm}>{COPY.confirm}</Button>
          </footer>
        </div>
      </FocusTrap>
    </div>,
    portalTarget,
  );
}
