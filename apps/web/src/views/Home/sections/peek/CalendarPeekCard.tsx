import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { homeQueryKeys } from '@sikao/api-client/homeQueryKeys';
import { useUpdateEvent } from '@sikao/api-client/plansMutations';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
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

type EditableField = 'title' | 'notes' | null;
type EditablePatch = Partial<Pick<PlanEventReadV2, 'title' | 'notes'>>;

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

function EditablePeekCardBody({ event, peek }: EditablePeekCardBodyProps) {
  const optimisticPatch = usePlanStore((state) => state.optimisticEvents.get(event.id));
  const upsertOptimisticEvent = usePlanStore((state) => state.upsertOptimisticEvent);
  const removeOptimisticEvent = usePlanStore((state) => state.removeOptimisticEvent);

  const [activeField, setActiveField] = useState<EditableField>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState(event.title);
  const [draftNotes, setDraftNotes] = useState(event.notes ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [committedPatch, setCommittedPatch] = useState<EditablePatch | null>(null);

  const updateEvent = useUpdateEvent(event.id);
  const queryClient = useQueryClient();

  const displayEvent = useMemo(
    () => ({
      ...event,
      ...(committedPatch ?? {}),
      ...(optimisticPatch ?? {}),
    }),
    [committedPatch, event, optimisticPatch],
  );

  const canStep = peek.listLength > 1;
  const kind = eventKindOf(displayEvent);
  const kindBarStyle: CSSProperties = {
    background: KIND_VAR_BY_KIND[kind],
  };

  const cancelEditing = useCallback(() => {
    if (activeField === null) return;
    if (activeField === 'title') setDraftTitle(displayEvent.title);
    if (activeField === 'notes') setDraftNotes(displayEvent.notes ?? '');
    setFieldError(null);
    setActiveField(null);
  }, [activeField, displayEvent.notes, displayEvent.title]);

  const handleClose = useCallback(() => {
    if (isSaving) return;
    if (activeField !== null) cancelEditing();
    peek.close();
  }, [activeField, cancelEditing, isSaving, peek]);

  const handlePrev = useCallback(() => {
    if (isSaving) return;
    if (activeField !== null) cancelEditing();
    peek.prev();
  }, [activeField, cancelEditing, isSaving, peek]);

  const handleNext = useCallback(() => {
    if (isSaving) return;
    if (activeField !== null) cancelEditing();
    peek.next();
  }, [activeField, cancelEditing, isSaving, peek]);

  const beginTitleEdit = useCallback(() => {
    if (isSaving) return;
    setDraftTitle(displayEvent.title);
    setFieldError(null);
    setActiveField('title');
  }, [displayEvent.title, isSaving]);

  const beginNotesEdit = useCallback(() => {
    if (isSaving) return;
    setDraftNotes(displayEvent.notes ?? '');
    setFieldError(null);
    setActiveField('notes');
  }, [displayEvent.notes, isSaving]);

  const restorePreviousOptimistic = useCallback(
    (previousPatch: Partial<PlanEventReadV2> | undefined) => {
      removeOptimisticEvent(event.id);
      if (previousPatch !== undefined) {
        upsertOptimisticEvent(event.id, previousPatch);
      }
    },
    [event.id, removeOptimisticEvent, upsertOptimisticEvent],
  );

  const commitField = useCallback(
    async (field: Exclude<EditableField, null>, payload: EditablePatch) => {
      const previousTitle = displayEvent.title;
      const previousNotes = displayEvent.notes ?? '';
      const previousOptimisticPatch = optimisticPatch;
      setIsSaving(true);
      setFieldError(null);
      upsertOptimisticEvent(event.id, payload);
      try {
        await updateEvent.mutateAsync(payload);
        await queryClient.refetchQueries({ queryKey: homeQueryKeys.plans.all() });
        restorePreviousOptimistic(previousOptimisticPatch);
        setCommittedPatch((prev) => ({ ...(prev ?? {}), ...payload }));
        setActiveField(null);
        setFieldError(null);
      } catch {
        restorePreviousOptimistic(previousOptimisticPatch);
        if (field === 'title') setDraftTitle(previousTitle);
        if (field === 'notes') setDraftNotes(previousNotes);
        setFieldError(CALENDAR_INLINE.saveFailed);
        toast.error(
          CALENDAR_INLINE.saveFailed,
          field === 'title' ? CALENDAR_INLINE.titleSaveFailed : CALENDAR_INLINE.notesSaveFailed,
        );
      } finally {
        setIsSaving(false);
      }
    },
    [displayEvent.notes, displayEvent.title, event.id, optimisticPatch, queryClient, restorePreviousOptimistic, updateEvent, upsertOptimisticEvent],
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
                    onClick={beginTitleEdit}
                    disabled={isSaving || activeField !== null}
                    aria-label="编辑标题"
                    title="edit-title"
                  >
                    Edit
                  </Button>
                </>
              )}
            </div>
            <CalendarPeekProperties event={displayEvent} />
            <CalendarPeekNotes
              event={displayEvent}
              isEditing={activeField === 'notes'}
              isSaving={isSaving}
              draft={draftNotes}
              errorText={activeField === 'notes' ? fieldError ?? undefined : undefined}
              bannerMode={activeField === null ? 'partial' : 'hidden'}
              editDisabled={activeField !== null}
              onDraftChange={setDraftNotes}
              onEdit={beginNotesEdit}
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
