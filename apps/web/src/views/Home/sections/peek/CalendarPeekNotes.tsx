// lint-allow-ui-copy: SIK-138 W6 Peek notes copy comes from visual contract
// §2 (备注 section) and the read-only banner copy from §6 SSOT conflict
// "mock Peek 可编辑 vs V1 read-only".
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

import styles from './CalendarPeekCard.module.css';

/*
 * CalendarPeekNotes — SIK-138 W6.
 *
 * Why: visual contract §2 places a notes section beneath the property
 *      table with a read-only banner explaining V1 scope. Empty notes
 *      render an italic placeholder so the section header always has a
 *      body — visual contract requires the section to be present even
 *      when the underlying field is null.
 */

export interface CalendarPeekNotesProps {
  readonly event: PlanEventReadV2;
}

export function CalendarPeekNotes({ event }: CalendarPeekNotesProps) {
  const notes = (event.notes ?? '').trim();
  return (
    <section className={styles.notesSection} data-testid="home-calendar-peek-notes-section">
      <h3 className={styles.notesHead}>备注</h3>
      {notes.length > 0 ? (
        <p className={styles.notesBody} data-testid="home-calendar-peek-notes">{notes}</p>
      ) : (
        <p className={styles.notesEmpty} data-testid="home-calendar-peek-notes-empty">
          暂无备注
        </p>
      )}
      <p className={styles.readonlyBanner} data-testid="home-calendar-peek-readonly-banner">
        V1 只读，编辑能力随后续阶段上线
      </p>
    </section>
  );
}
