import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

import { FocusTrap } from '../../../../components/system/FocusTrap';
import { eventKindOf, type EventKind } from '../eventKind';
import { CalendarPeekHead } from './CalendarPeekHead';
import { CalendarPeekNotes } from './CalendarPeekNotes';
import { CalendarPeekProperties } from './CalendarPeekProperties';
import { useCalendarPeek } from './useCalendarPeek';
import styles from './CalendarPeekCard.module.css';

/*
 * CalendarPeekCard — SIK-138 W6.
 *
 * Why: requirements.md Requirement 12 + design.md "Peek Card · V1 scope"
 *      lock the read-only peek surface. The card wires together:
 *        - portal-mounted overlay (createPortal to document.body)
 *        - FocusTrap (D14 reuse — no new trap)
 *        - body scroll lock while open
 *        - Esc closes
 *        - ArrowUp / ArrowDown walk inside list scope
 *        - scrim click closes
 *
 *      AGENT-H7: missing peek state (provider not mounted) is a wiring
 *      bug; useCalendarPeek throws so we surface it loudly.
 */

const KIND_VAR_BY_KIND: Readonly<Record<EventKind, string>> = {
  plan: 'var(--cal-kind-plan)',
  practice: 'var(--cal-kind-practice)',
  mock: 'var(--cal-kind-mock)',
  milestone: 'var(--cal-kind-milestone)',
};

export function CalendarPeekCard() {
  const peek = useCalendarPeek();
  const open = peek.isOpen && peek.currentEvent !== null;
  const event = peek.currentEvent;

  // Esc + ArrowUp / ArrowDown handler. Only attach while open so closed
  // peeks do not steal global key events.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        peek.close();
        return;
      }
      if (peek.listLength <= 1) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        peek.next();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        peek.prev();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, peek]);

  // Body scroll lock while open. Mirrors the Sheet / Modal pattern so the
  // page underneath does not scroll when the user wheels inside the peek.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || event === null) return null;
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  const kind = eventKindOf(event);
  const kindBarStyle: CSSProperties = {
    background: KIND_VAR_BY_KIND[kind],
  };
  const canStep = peek.listLength > 1;

  return createPortal(
    <div
      className={styles.overlay}
      data-testid="home-calendar-peek-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) peek.close();
      }}
    >
      <FocusTrap active={open}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-calendar-peek-title"
          className={styles.card}
          data-testid="home-calendar-peek-card"
        >
          <CalendarPeekHead
            onClose={peek.close}
            onPrev={peek.prev}
            onNext={peek.next}
            canStep={canStep}
            currentIndex={peek.currentIndex}
            listLength={peek.listLength}
          />
          <div className={styles.body} data-testid="home-calendar-peek-body">
            <span className={styles.kindBar} style={kindBarStyle} aria-hidden="true" />
            <h2 id="home-calendar-peek-title" className={styles.title}>
              {event.title}
            </h2>
            <CalendarPeekProperties event={event} />
            <CalendarPeekNotes event={event} />
          </div>
        </div>
      </FocusTrap>
    </div>,
    portalTarget,
  );
}
