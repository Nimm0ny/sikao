import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { homeQueryKeys } from '@sikao/api-client/homeQueryKeys';
import { useUpdateEvent } from '@sikao/api-client/plansMutations';
import type { PlanEventReadV2, PlanEventUpdateRequestV2 } from '@sikao/api-client/types/home';
import { usePlanStore } from '@sikao/domain';
import { toast } from '@sikao/shared-utils';

import { Button, Input } from '../../../../components/form';
import { CALENDAR_INLINE } from '../../../../lib/ui-copy';
import { FocusTrap } from '../../../../components/system/FocusTrap';
import { eventKindOf, type EventKind } from '../eventKind';
import { CalendarPeekHead } from './CalendarPeekHead';
import { CalendarPeekNotes } from './CalendarPeekNotes';
import { CalendarPeekProperties } from './CalendarPeekProperties';
import { useCalendarPeek } from './useCalendarPeek';
import type { CalendarPeekContextValue } from './types';
import styles from './CalendarPeekCard.module.css';

type EditableField = 'title' | 'notes' | 'status' | 'category' | 'targetId' | null;
type EditableStatus = NonNullable<PlanEventUpdateRequestV2['status']>;
type EditablePatch = {
  readonly title?: string;
  readonly notes?: string;
  readonly status?: EditableStatus;
  readonly category?: string;
  readonly targetId?: number | null;
};

const SAVE_FAILURE_MESSAGE_BY_FIELD: Readonly<Record<Exclude<EditableField, null>, string>> = {
  title: CALENDAR_INLINE.titleSaveFailed,
  notes: CALENDAR_INLINE.notesSaveFailed,
  status: CALENDAR_INLINE.statusSaveFailed,
  category: CALENDAR_INLINE.categorySaveFailed,
  targetId: CALENDAR_INLINE.targetSaveFailed,
};

const KIND_VAR_BY_KIND: Readonly<Record<EventKind, string>> = {
  plan: 'var(--cal-kind-plan)',
  practice: 'var(--cal-kind-practice)',
  mock: 'var(--cal-kind-mock)',
  milestone: 'var(--cal-kind-milestone)',
};

interface EditablePeekCardBodyProps {
  readonly event: PlanEventReadV2;
  readonly peek: CalendarPeekContextValue;
}

function uniqueSortedStrings(values: ReadonlyArray<string>): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}

function uniqueSortedNumbers(values: ReadonlyArray<number>): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function EditablePeekCardBody({ event, peek }: EditablePeekCardBodyProps) {
  const optimisticPatch = usePlanStore((state) => state.optimisticEvents.get(event.id));
  const upsertOptimisticEvent = usePlanStore((state) => state.upsertOptimisticEvent);
  const removeOptimisticEvent = usePlanStore((state) => state.removeOptimisticEvent);

  const [activeField, setActiveField] = useState<EditableField>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState(event.title);
  const [draftNotes, setDraftNotes] = useState(event.notes ?? '');
  const [draftStatus, setDraftStatus] = useState<EditableStatus>(event.status as EditableStatus);
  const [draftCategory, setDraftCategory] = useState(event.category);
  const [draftTargetId, setDraftTargetId] = useState(
    event.targetId === null || event.targetId === undefined ? '' : String(event.targetId),
  );
  const [fieldError, setFieldError] = useState<string | null>(null);

  const updateEvent = useUpdateEvent(event.id);
  const queryClient = useQueryClient();

  const displayEvent = useMemo(
    () => ({
      ...event,
      ...(optimisticPatch ?? {}),
    }),
    [event, optimisticPatch],
  );

  const canStep = peek.listLength > 1;
  const kind = eventKindOf(displayEvent);
  const kindBarStyle: CSSProperties = {
    background: KIND_VAR_BY_KIND[kind],
  };

  const categoryOptions = useMemo(() => {
    const values = peek.currentList.map((entry) => entry.event.category);
    values.push(displayEvent.category);
    return uniqueSortedStrings(values);
  }, [displayEvent.category, peek.currentList]);

  const targetOptions = useMemo(() => {
    const values = peek.currentList
      .map((entry) => entry.event.targetId)
      .filter((value): value is number => typeof value === 'number');
    if (typeof displayEvent.targetId === 'number') values.push(displayEvent.targetId);
    return uniqueSortedNumbers(values);
  }, [displayEvent.targetId, peek.currentList]);
  const canEditCategory = categoryOptions.length > 0;
  const canEditTarget = typeof displayEvent.targetId === 'number' || targetOptions.length > 0;

  const resetDraftForField = useCallback((field: Exclude<EditableField, null>) => {
    if (field === 'title') setDraftTitle(displayEvent.title);
    if (field === 'notes') setDraftNotes(displayEvent.notes ?? '');
    if (field === 'status') setDraftStatus(displayEvent.status as EditableStatus);
    if (field === 'category') setDraftCategory(displayEvent.category);
    if (field === 'targetId') {
      setDraftTargetId(
        displayEvent.targetId === null || displayEvent.targetId === undefined ? '' : String(displayEvent.targetId),
      );
    }
  }, [displayEvent.category, displayEvent.notes, displayEvent.status, displayEvent.targetId, displayEvent.title]);

  const cancelEditing = useCallback(() => {
    if (activeField === null) return;
    resetDraftForField(activeField);
    setFieldError(null);
    setActiveField(null);
  }, [activeField, resetDraftForField]);

  const handleClose = useCallback(() => {
    if (isSaving) return;
    if (activeField !== null) cancelEditing();
    peek.close();
  }, [activeField, cancelEditing, isSaving, peek]);

  const handlePrev = useCallback(() => {
    if (isSaving || activeField !== null) return;
    peek.prev();
  }, [activeField, isSaving, peek]);

  const handleNext = useCallback(() => {
    if (isSaving || activeField !== null) return;
    peek.next();
  }, [activeField, isSaving, peek]);

  const beginEdit = useCallback((field: Exclude<EditableField, null>) => {
    if (isSaving) return;
    resetDraftForField(field);
    setFieldError(null);
    setActiveField(field);
  }, [isSaving, resetDraftForField]);

  const restorePreviousOptimistic = useCallback(
    (previousPatch: Partial<PlanEventReadV2> | undefined) => {
      removeOptimisticEvent(event.id);
      if (previousPatch !== undefined) upsertOptimisticEvent(event.id, previousPatch);
    },
    [event.id, removeOptimisticEvent, upsertOptimisticEvent],
  );

  const commitField = useCallback(
    async (field: Exclude<EditableField, null>, payload: EditablePatch) => {
      const previousState = {
        title: displayEvent.title,
        notes: displayEvent.notes ?? '',
        status: displayEvent.status as EditableStatus,
        category: displayEvent.category,
        targetId: displayEvent.targetId === null || displayEvent.targetId === undefined ? '' : String(displayEvent.targetId),
      };
      const previousOptimisticPatch = optimisticPatch;
      setIsSaving(true);
      setFieldError(null);
      upsertOptimisticEvent(event.id, payload);
      try {
        await updateEvent.mutateAsync(payload);
        await queryClient.refetchQueries({ queryKey: homeQueryKeys.plans.all() });
        peek.commitEvent(event.id, payload);
        restorePreviousOptimistic(previousOptimisticPatch);
        setActiveField(null);
        setFieldError(null);
      } catch {
        restorePreviousOptimistic(previousOptimisticPatch);
        if (field === 'title') setDraftTitle(previousState.title);
        if (field === 'notes') setDraftNotes(previousState.notes);
        if (field === 'status') setDraftStatus(previousState.status);
        if (field === 'category') setDraftCategory(previousState.category);
        if (field === 'targetId') setDraftTargetId(previousState.targetId);
        setFieldError(CALENDAR_INLINE.saveFailed);
        toast.error(CALENDAR_INLINE.saveFailed, SAVE_FAILURE_MESSAGE_BY_FIELD[field]);
      } finally {
        setIsSaving(false);
      }
    },
    [displayEvent.category, displayEvent.notes, displayEvent.status, displayEvent.targetId, displayEvent.title, event.id, optimisticPatch, peek, queryClient, restorePreviousOptimistic, updateEvent, upsertOptimisticEvent],
  );

  const saveTitle = useCallback(async () => {
    const nextTitle = draftTitle.trim();
    if (nextTitle.length === 0) {
      setFieldError(CALENDAR_INLINE.emptyTitle);
      return;
    }
    if (nextTitle === displayEvent.title) {
      setActiveField(null);
      setFieldError(null);
      return;
    }
    await commitField('title', { title: nextTitle });
  }, [commitField, displayEvent.title, draftTitle]);

  const saveNotes = useCallback(async () => {
    if (draftNotes === (displayEvent.notes ?? '')) {
      setActiveField(null);
      setFieldError(null);
      return;
    }
    await commitField('notes', { notes: draftNotes });
  }, [commitField, displayEvent.notes, draftNotes]);

  const saveStatus = useCallback(async () => {
    if (draftStatus === displayEvent.status) {
      setActiveField(null);
      setFieldError(null);
      return;
    }
    await commitField('status', { status: draftStatus });
  }, [commitField, displayEvent.status, draftStatus]);

  const saveCategory = useCallback(async () => {
    if (!categoryOptions.includes(draftCategory)) {
      setFieldError(CALENDAR_INLINE.invalidCategory);
      return;
    }
    if (draftCategory === displayEvent.category) {
      setActiveField(null);
      setFieldError(null);
      return;
    }
    await commitField('category', { category: draftCategory });
  }, [categoryOptions, commitField, displayEvent.category, draftCategory]);

  const saveTarget = useCallback(async () => {
    const trimmed = draftTargetId.trim();
    if (trimmed.length === 0) {
      if (displayEvent.targetId === null || displayEvent.targetId === undefined) {
        setActiveField(null);
        setFieldError(null);
        return;
      }
      await commitField('targetId', { targetId: null });
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0 || !targetOptions.includes(parsed)) {
      setFieldError(CALENDAR_INLINE.invalidTarget);
      return;
    }
    if (parsed === displayEvent.targetId) {
      setActiveField(null);
      setFieldError(null);
      return;
    }
    await commitField('targetId', { targetId: parsed });
  }, [commitField, displayEvent.targetId, draftTargetId, targetOptions]);

  useEffect(() => {
    function handleKeyDown(event_: KeyboardEvent) {
      if (isSaving) {
        if (event_.key === 'Escape') event_.preventDefault();
        return;
      }
      if (activeField !== null) {
        if (event_.key === 'Escape') {
          event_.preventDefault();
          cancelEditing();
        }
        return;
      }
      if (event_.key === 'Escape') {
        event_.preventDefault();
        handleClose();
        return;
      }
      if (canStep && event_.key === 'ArrowDown') {
        event_.preventDefault();
        handleNext();
      } else if (canStep && event_.key === 'ArrowUp') {
        event_.preventDefault();
        handlePrev();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeField, canStep, cancelEditing, handleClose, handleNext, handlePrev, isSaving]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function handleTitleKeyDown(event_: ReactKeyboardEvent<HTMLInputElement>) {
    if (event_.nativeEvent.isComposing) return;
    if (event_.key === 'Escape') {
      event_.preventDefault();
      cancelEditing();
      return;
    }
    if (event_.key === 'Enter' && !isSaving) {
      event_.preventDefault();
      void saveTitle();
    }
  }

  function handlePropEditorKeyDown(event_: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event_.nativeEvent.isComposing) return;
    if (event_.key === 'Escape') {
      event_.preventDefault();
      cancelEditing();
      return;
    }
    if (event_.key !== 'Enter' || isSaving) return;
    if (event_.currentTarget.getAttribute('aria-expanded') === 'true') return;
    event_.preventDefault();
    if (activeField === 'status') {
      void saveStatus();
      return;
    }
    if (activeField === 'category') {
      void saveCategory();
      return;
    }
    if (activeField === 'targetId') {
      void saveTarget();
    }
  }

  return (
    <div
      className={styles.overlay}
      data-testid="home-calendar-peek-overlay"
      role="presentation"
      onClick={(event_) => {
        if (event_.target !== event_.currentTarget) return;
        if (isSaving) return;
        if (activeField !== null) cancelEditing();
        peek.close();
      }}
    >
      <FocusTrap active>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-calendar-peek-title"
          className={styles.card}
          data-testid="home-calendar-peek-card"
        >
          <CalendarPeekHead
            onClose={handleClose}
            onPrev={handlePrev}
            onNext={handleNext}
            canStep={canStep}
            currentIndex={peek.currentIndex}
            listLength={peek.listLength}
            navigationDisabled={isSaving || activeField !== null}
            closeDisabled={isSaving}
          />
          <div className={styles.body} data-testid="home-calendar-peek-body">
            <span className={styles.kindBar} style={kindBarStyle} aria-hidden="true" />
            <div className={styles.sectionHead}>
              {activeField === 'title' ? (
                <div className={styles.editorBlock} data-testid="home-calendar-peek-title-editor">
                  <h2 id="home-calendar-peek-title" className={styles.srOnly}>
                    {displayEvent.title}
                  </h2>
                  <Input
                    value={draftTitle}
                    onChange={setDraftTitle}
                    autoFocus
                    onKeyDown={handleTitleKeyDown}
                    disabled={isSaving}
                    invalid={fieldError !== null}
                    errorText={fieldError ?? undefined}
                    aria-label="编辑标题"
                  />
                  <div className={styles.fieldActions}>
                    <Button variant="primary" size="sm" onClick={() => { void saveTitle(); }} disabled={isSaving} title="save-title">
                      Save
                    </Button>
                    <Button variant="secondary" size="sm" onClick={cancelEditing} disabled={isSaving} title="cancel-title">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 id="home-calendar-peek-title" className={styles.title}>
                    {displayEvent.title}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => beginEdit('title')}
                    disabled={isSaving || activeField !== null}
                    aria-label="编辑标题"
                    title="edit-title"
                  >
                    Edit
                  </Button>
                </>
              )}
            </div>
            <CalendarPeekProperties
              event={displayEvent}
              activeField={activeField === 'status' || activeField === 'category' || activeField === 'targetId' ? activeField : null}
              isSaving={isSaving}
              draftStatus={draftStatus}
              draftCategory={draftCategory}
              draftTargetId={draftTargetId}
              fieldError={activeField === 'status' || activeField === 'category' || activeField === 'targetId' ? fieldError ?? undefined : undefined}
              editDisabled={activeField !== null}
              categoryOptions={categoryOptions}
              targetOptions={targetOptions}
              canEditCategory={canEditCategory}
              canEditTarget={canEditTarget}
              onEditStatus={() => beginEdit('status')}
              onEditCategory={() => beginEdit('category')}
              onEditTarget={() => beginEdit('targetId')}
              onStatusChange={setDraftStatus}
              onCategoryChange={setDraftCategory}
              onTargetChange={setDraftTargetId}
              onEditorKeyDown={handlePropEditorKeyDown}
              onSave={() => {
                if (activeField === 'status') void saveStatus();
                if (activeField === 'category') void saveCategory();
                if (activeField === 'targetId') void saveTarget();
              }}
              onCancel={cancelEditing}
            />
            <CalendarPeekNotes
              event={displayEvent}
              isEditing={activeField === 'notes'}
              isSaving={isSaving}
              draft={draftNotes}
              errorText={activeField === 'notes' ? fieldError ?? undefined : undefined}
              editDisabled={activeField !== null}
              onDraftChange={setDraftNotes}
              onEdit={() => beginEdit('notes')}
              onCancel={cancelEditing}
              onSave={() => {
                void saveNotes();
              }}
            />
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

export function CalendarPeekCard() {
  const peek = useCalendarPeek();
  const open = peek.isOpen && peek.currentEvent !== null;
  const event = peek.currentEvent;
  if (!open || event === null) return null;
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;
  return createPortal(
    <EditablePeekCardBody key={event.id} event={event} peek={peek} />,
    portalTarget,
  );
}
