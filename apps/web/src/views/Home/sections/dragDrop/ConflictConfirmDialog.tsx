import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { EventConflictItemV2 } from '@sikao/api-client/types/home';

import { CALENDAR_DND } from '../../../../lib/ui-copy';
import { Button } from '../../../../components/form/Button/Button';
import { FocusTrap } from '../../../../components/system/FocusTrap';
import styles from './ConflictConfirmDialog.module.css';

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatConflictTime(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startAt} - ${endAt}`;
  }
  return `${TIME_FMT.format(start)} - ${TIME_FMT.format(end)}`;
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
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, open]);

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
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
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
            <h2 id="home-conflict-title" className={styles.title}>
              {CALENDAR_DND.conflictTitle}
            </h2>
            <p id="home-conflict-subtitle" className={styles.subtitle}>
              {CALENDAR_DND.conflictSubtitle}
            </p>
          </header>
          <div className={styles.body}>
            <ul className={styles.list} data-testid="home-conflict-list">
              {conflicts.map((conflict) => (
                <li key={`${conflict.kind}:${conflict.sourceId}`} className={styles.item}>
                  <span className={styles.itemTitle}>{conflict.title}</span>
                  <span className={styles.itemTime}>
                    {formatConflictTime(conflict.startAt, conflict.endAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <footer className={styles.footer}>
            <Button variant="secondary" onClick={onCancel}>
              {CALENDAR_DND.cancel}
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              {CALENDAR_DND.confirmReschedule}
            </Button>
          </footer>
        </div>
      </FocusTrap>
    </div>,
    portalTarget,
  );
}
