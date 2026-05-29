// lint-allow-ui-copy: SIK-140 W2/W3 editable property row labels and edit CTA
// are issue-scoped and aligned with the define-first contract.
import type { KeyboardEventHandler } from 'react';

import type { PlanEventReadV2, PlanEventUpdateRequestV2 } from '@sikao/api-client/types/home';

import { Button, Select } from '../../../../components/form';
import { eventKindLabel, eventKindOf } from '../eventKind';
import styles from './CalendarPeekCard.module.css';

const STATUS_LABEL: Readonly<Record<string, string>> = {
  planned: '待办',
  in_progress: '进行中',
  done: '已完成',
  skipped: '跳过',
};

const SOURCE_LABEL: Readonly<Record<string, string>> = {
  ai: 'AI 排程',
  manual: '人工创建',
  import: '外部导入',
};

const STATUS_OPTIONS = [
  { value: 'planned', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'skipped', label: '跳过' },
] as const;

const PLACEHOLDER = '—';
type EditableStatus = NonNullable<PlanEventUpdateRequestV2['status']>;
type EditablePropField = 'status' | 'category' | 'targetId' | null;

export interface CalendarPeekPropertiesProps {
  readonly event: PlanEventReadV2;
  readonly activeField: EditablePropField;
  readonly isSaving: boolean;
  readonly draftStatus: EditableStatus;
  readonly draftCategory: string;
  readonly draftTargetId: string;
  readonly fieldError?: string;
  readonly editDisabled?: boolean;
  readonly categoryOptions: readonly string[];
  readonly targetOptions: readonly number[];
  readonly canEditCategory: boolean;
  readonly canEditTarget: boolean;
  readonly onEditStatus: () => void;
  readonly onEditCategory: () => void;
  readonly onEditTarget: () => void;
  readonly onStatusChange: (value: EditableStatus) => void;
  readonly onCategoryChange: (value: string) => void;
  readonly onTargetChange: (value: string) => void;
  readonly onEditorKeyDown: KeyboardEventHandler<HTMLButtonElement>;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

function formatTimeRange(event: PlanEventReadV2): string {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const datePart = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  return sameDay
    ? `${datePart} ${fmt(start)} – ${fmt(end)}`
    : `${datePart} ${fmt(start)} → ${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())} ${fmt(end)}`;
}

function renderReadonlyValue(event: PlanEventReadV2, key: string): string {
  const kind = eventKindOf(event);
  switch (key) {
    case 'time':
      return formatTimeRange(event);
    case 'kind':
      return eventKindLabel(kind);
    case 'category':
      return event.category || PLACEHOLDER;
    case 'status':
      return STATUS_LABEL[event.status] ?? event.status;
    case 'source':
      return SOURCE_LABEL[event.source] ?? event.source;
    case 'linkedSession':
      return event.linkedSessionId === null || event.linkedSessionId === undefined
        ? PLACEHOLDER
        : String(event.linkedSessionId);
    case 'target':
      return event.targetId === null || event.targetId === undefined
        ? PLACEHOLDER
        : String(event.targetId);
    case 'recurring':
      return event.recurringRule ?? PLACEHOLDER;
    default:
      return PLACEHOLDER;
  }
}

function fieldActions(
  onSave: () => void,
  onCancel: () => void,
  isSaving: boolean,
  saveTitle: string,
  cancelTitle: string,
) {
  return (
    <div className={styles.fieldActions}>
      <Button variant="primary" size="sm" onClick={onSave} disabled={isSaving} title={saveTitle}>
        Save
      </Button>
      <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSaving} title={cancelTitle}>
        Cancel
      </Button>
    </div>
  );
}

export function CalendarPeekProperties({
  event,
  activeField,
  isSaving,
  draftStatus,
  draftCategory,
  draftTargetId,
  fieldError,
  editDisabled = false,
  categoryOptions,
  targetOptions,
  canEditCategory,
  canEditTarget,
  onEditStatus,
  onEditCategory,
  onEditTarget,
  onStatusChange,
  onCategoryChange,
  onTargetChange,
  onEditorKeyDown,
  onSave,
  onCancel,
}: CalendarPeekPropertiesProps) {
  const rows = [
    { key: 'time', label: '时间', testId: 'home-calendar-peek-time' },
    { key: 'kind', label: '类型', testId: 'home-calendar-peek-kind' },
    { key: 'category', label: '分类', testId: 'home-calendar-peek-category' },
    { key: 'status', label: '状态', testId: 'home-calendar-peek-status' },
    { key: 'source', label: '来源', testId: 'home-calendar-peek-source' },
    { key: 'linkedSession', label: '关联会话', testId: 'home-calendar-peek-linked' },
    { key: 'target', label: '目标', testId: 'home-calendar-peek-target' },
    { key: 'recurring', label: '重复', testId: 'home-calendar-peek-recurring' },
  ] as const;

  return (
    <dl className={styles.props} data-testid="home-calendar-peek-properties">
      {rows.map((row) => {
        const editingStatus = row.key === 'status' && activeField === 'status';
        const editingCategory = row.key === 'category' && activeField === 'category';
        const editingTarget = row.key === 'target' && activeField === 'targetId';
        const rowEditDisabled = isSaving || editDisabled;

        return (
          <div key={row.key} className={styles.propRow}>
            <dt className={styles.propLabel}>{row.label}</dt>
            <dd className={styles.propValue} data-testid={row.testId}>
              {editingStatus ? (
                <div className={styles.editorBlock} data-testid="home-calendar-peek-status-editor">
                  <Select
                    value={draftStatus}
                    onChange={onStatusChange}
                    options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                    autoFocus
                    onKeyDown={onEditorKeyDown}
                    aria-label="编辑状态"
                    disabled={isSaving}
                  />
                  {fieldError ? <span className={styles.propError}>{fieldError}</span> : null}
                  {fieldActions(onSave, onCancel, isSaving, 'save-status', 'cancel-status')}
                </div>
              ) : editingCategory ? (
                <div className={styles.editorBlock} data-testid="home-calendar-peek-category-editor">
                  <Select
                    value={draftCategory}
                    onChange={onCategoryChange}
                    options={categoryOptions.map((option) => ({ value: option, label: option }))}
                    autoFocus
                    onKeyDown={onEditorKeyDown}
                    aria-label="编辑分类"
                    disabled={isSaving}
                  />
                  {fieldError ? <span className={styles.propError}>{fieldError}</span> : null}
                  {fieldActions(onSave, onCancel, isSaving, 'save-category', 'cancel-category')}
                </div>
              ) : editingTarget ? (
                <div className={styles.editorBlock} data-testid="home-calendar-peek-target-editor">
                  <Select
                    value={draftTargetId}
                    onChange={onTargetChange}
                    options={[
                      { value: '', label: '无' },
                      ...targetOptions.map((option) => ({ value: String(option), label: String(option) })),
                    ]}
                    autoFocus
                    onKeyDown={onEditorKeyDown}
                    aria-label="编辑目标"
                    disabled={isSaving}
                  />
                  {fieldError ? <span className={styles.propError}>{fieldError}</span> : null}
                  {fieldActions(onSave, onCancel, isSaving, 'save-target', 'cancel-target')}
                </div>
              ) : row.key === 'status' ? (
                <div className={styles.sectionHead}>
                  <span>{renderReadonlyValue(event, row.key)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEditStatus}
                    disabled={rowEditDisabled}
                    aria-label="编辑状态"
                    title="edit-status"
                  >
                    Edit
                  </Button>
                </div>
              ) : row.key === 'category' ? (
                <div className={styles.sectionHead}>
                  <span>{renderReadonlyValue(event, row.key)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEditCategory}
                    disabled={rowEditDisabled || !canEditCategory}
                    aria-label="编辑分类"
                    title="edit-category"
                  >
                    Edit
                  </Button>
                </div>
              ) : row.key === 'target' ? (
                <div className={styles.sectionHead}>
                  <span>{renderReadonlyValue(event, row.key)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEditTarget}
                    disabled={rowEditDisabled || !canEditTarget}
                    aria-label="编辑目标"
                    title="edit-target"
                  >
                    Edit
                  </Button>
                </div>
              ) : (
                renderReadonlyValue(event, row.key)
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
