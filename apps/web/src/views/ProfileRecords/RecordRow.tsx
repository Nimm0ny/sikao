// lint-allow-ui-copy: V5 ProfileRecords timeline event-row copy. CJK
// strings are visual contract from `Profile Records v1.html` lines 58-104.
// Nav baseline (4 tabs) untouched — this is a per-event timeline row.
import { Link } from 'react-router-dom';
import type { components } from '@sikao/api-client/types/api.generated';
import { SpriteIcon } from '../../components/atom/SpriteIcon';
import {
  formatTime,
  iconIdForVariant,
  tagLabelForKind,
  variantForKind,
} from './group';
import styles from './RecordRow.module.css';

/*
 * RecordRow — single event row in the ProfileRecords timeline.
 *
 * Why: sik-fu-c §2.3 + Acceptance C5 — 4-col grid (time / ico / body /
 *      actions). Ico tinted by `kind` variant (6 buckets); fallback for
 *      unknown kind uses neutral surface (no fake mapping). Body has
 *      title + tag + score / status meta + AGENT-H7 strict no-dash
 *      fabrication: `score === null` falls back to status text rather
 *      than rendering a fake number. Actions slot is hover-revealed on
 *      desktop, always visible on touch (no-hover devices).
 *
 *      Score rendering: backend ships `score` as a string (Decimal). We
 *      render verbatim and only when present, otherwise we render the
 *      status to avoid presenting fabricated context.
 */

type LearningRecordItemV2 = components['schemas']['LearningRecordItemV2'];

const STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  pending: '待批阅',
  failed: '失败',
};

function statusLabelFor(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export interface RecordRowProps {
  readonly record: LearningRecordItemV2;
}

export function RecordRow({ record }: RecordRowProps) {
  const variant = variantForKind(record.kind);
  const tagLabel = tagLabelForKind(record.kind);
  const iconId = iconIdForVariant(variant);
  const time = formatTime(record.occurredAt);
  const status = statusLabelFor(record.status);

  return (
    <Link
      to={record.href}
      className={styles.event}
      data-kind={variant}
      data-testid={`profile-records-row-${record.id}`}
    >
      <span className={styles.time}>{time}</span>
      <span className={styles.ico} aria-hidden="true">
        <SpriteIcon id={iconId} size={14} />
      </span>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{record.title}</span>
          <span className={styles.tag} data-kind={variant}>{tagLabel}</span>
        </div>
        <div className={styles.stats}>
          {record.score !== null && record.score !== undefined && record.score !== '' ? (
            <span className={`${styles.stat} ${styles.statOk}`}>
              <span>得分</span>
              <b>{record.score}</b>
            </span>
          ) : null}
          <span className={styles.stat} data-status={record.status}>
            <span>状态</span>
            <b>{status}</b>
          </span>
        </div>
      </div>
      <div className={styles.actions} aria-hidden="true">
        <span className={styles.actionPill} role="presentation">
          <SpriteIcon id="chevron-right" size={14} />
        </span>
      </div>
    </Link>
  );
}
