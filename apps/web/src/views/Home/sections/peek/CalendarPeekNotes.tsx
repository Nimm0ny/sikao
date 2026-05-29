// lint-allow-ui-copy: SIK-140 W1 notes editor / partial-editable banner copy
// is issue-scoped and documented in the define-first spec + visual contract.
import type { KeyboardEvent } from 'react';

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

import { Button, Textarea } from '../../../../components/form';
import styles from './CalendarPeekCard.module.css';

const PARTIAL_EDITABLE_BANNER = '部分字段现已可编辑；时间与重复规则仍为只读。';

export interface CalendarPeekNotesProps {
  readonly event: PlanEventReadV2;
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly draft: string;
  readonly errorText?: string;
  readonly bannerMode: 'partial' | 'hidden';
  readonly editDisabled?: boolean;
  readonly onDraftChange: (value: string) => void;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}

export function CalendarPeekNotes({
  event,
  isEditing,
  isSaving,
  draft,
  errorText,
  bannerMode,
  editDisabled = false,
  onDraftChange,
  onEdit,
  onCancel,
  onSave,
}: CalendarPeekNotesProps) {
  const notes = (event.notes ?? '').trim();

  function handleKeyDown(event_: KeyboardEvent<HTMLTextAreaElement>) {
    if (event_.nativeEvent.isComposing) return;
    if (event_.key === 'Escape') {
      event_.preventDefault();
      onCancel();
      return;
    }
    if ((event_.metaKey || event_.ctrlKey) && event_.key === 'Enter') {
      event_.preventDefault();
      if (!isSaving) onSave();
    }
  }

  return (
    <section className={styles.notesSection} data-testid="home-calendar-peek-notes-section">
      <div className={styles.sectionHead}>
        <h3 className={styles.notesHead}>备注</h3>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            disabled={isSaving || editDisabled}
            aria-label="编辑备注"
            title="edit-notes"
          >
            Edit
          </Button>
        ) : null}
      </div>
      {isEditing ? (
        <div className={styles.editorBlock} data-testid="home-calendar-peek-notes-editor">
          <Textarea
            value={draft}
            onChange={onDraftChange}
            autosize={{ min: 4, max: 8 }}
            autoFocus
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            invalid={errorText !== undefined}
            errorText={errorText}
            aria-label="编辑备注"
          />
          <div className={styles.fieldActions}>
            <Button variant="primary" size="sm" onClick={onSave} disabled={isSaving} title="save-notes">
              Save
            </Button>
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSaving} title="cancel-notes">
              Cancel
            </Button>
          </div>
        </div>
      ) : notes.length > 0 ? (
        <p className={styles.notesBody} data-testid="home-calendar-peek-notes">{notes}</p>
      ) : (
        <p className={styles.notesEmpty} data-testid="home-calendar-peek-notes-empty">
          暂无备注
        </p>
      )}
      {bannerMode === 'partial' && !isEditing ? (
        <p className={styles.readonlyBanner} data-testid="home-calendar-peek-readonly-banner">
          {PARTIAL_EDITABLE_BANNER}
        </p>
      ) : null}
    </section>
  );
}
