/*
 * EventKindIcon — SIK-142 W1 (visual contract §4.3). Neutral leading kind
 * icon for the calendar chip.
 *
 * Why: the chip color channel now encodes time-completion status (tone), so
 *      kind drops its color and surfaces as a NEUTRAL leading icon
 *      (--color-text-meta, --cal-icon-size; styled by the caller's class).
 *      kind → glyph mapping (mirrors eventKindOf / eventKindLabel):
 *        - plan      → CalendarDays (a scheduled study slot)
 *        - practice  → Dumbbell     (drill / specialty practice)
 *        - mock      → FileCheck    (a full graded simulation exam)
 *        - milestone → Flag         (exam / registration / deadline marker)
 *
 *      A direct per-kind switch keeps every icon a statically-imported
 *      component reference (no component value built during render), so this
 *      lives in its own file beside eventKind.ts rather than as a helper that
 *      returns a component.
 */
import { CalendarDays, Dumbbell, FileCheck, Flag } from 'lucide-react';

import type { EventKind } from './eventKind';

export interface EventKindIconProps {
  readonly kind: EventKind;
  readonly className?: string;
}

export function EventKindIcon({ kind, className }: EventKindIconProps) {
  switch (kind) {
    case 'practice':
      return <Dumbbell className={className} role="img" aria-hidden="true" data-testid="home-month-event-kind-icon" />;
    case 'mock':
      return <FileCheck className={className} role="img" aria-hidden="true" data-testid="home-month-event-kind-icon" />;
    case 'milestone':
      return <Flag className={className} role="img" aria-hidden="true" data-testid="home-month-event-kind-icon" />;
    case 'plan':
    default:
      return <CalendarDays className={className} role="img" aria-hidden="true" data-testid="home-month-event-kind-icon" />;
  }
}
