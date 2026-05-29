/*
 * deriveChipTone — SIK-142 W1 (visual contract §3.2). Single source of truth
 * for the calendar chip's TIME-COMPLETION-STATUS color channel.
 *
 * Why a pure function: the chip color no longer encodes event kind (kind is a
 *      neutral leading icon now — §3.1). The five tones cascade
 *      done > skipped > overdue > today > future and stop at the first match.
 *
 * H7 anchoring (contract §3.2 borderline):
 *   - today / future anchor on the occurrence START local day; a cross-day
 *     slice anchors on `slice.day` (the cell the chip is rendered in).
 *   - overdue uses the occurrence END local day < today.
 *   - everything is compared as Asia/Shanghai `YYYY-MM-DD` strings (NOT a
 *     naked UTC Date), and `zonedDateKey` throws on an unparseable timestamp
 *     — never a silent fallback to "today".
 *
 * Partition note: done / skipped are status-driven and return first. The
 * remaining three are a disjoint partition of the anchor day vs today:
 *   anchorDay  > today        → future
 *   anchorDay == today        → today
 *   anchorDay  < today        → overdue if the occurrence already ENDED
 *                               (endDay < today), else today (still active).
 */
import { zonedDateKey } from '@sikao/shared-utils';

export type ChipTone = 'done' | 'skipped' | 'overdue' | 'today' | 'future';

/** Structural subset of `PlanEventReadV2` the tone derivation reads. */
export interface ChipToneEvent {
  readonly status: string;
  readonly startAt: string;
  readonly endAt: string;
}

/** Structural subset of `CrossDaySlice` (only the rendered cell day matters). */
export interface ChipToneSlice {
  readonly day: string;
}

const DEFAULT_TZ = 'Asia/Shanghai';

/**
 * Derive the chip tone for an event occurrence.
 *
 * @param event  the (optimistically-patched) event — status / start / end.
 * @param today  current local day as `YYYY-MM-DD` (Asia/Shanghai).
 * @param slice  cross-day slice, when the chip is one day of a multi-day
 *               occurrence; its `day` anchors the today/future test.
 * @param timeZone IANA zone for local-day comparison (default Asia/Shanghai).
 * @throws if a timestamp cannot be parsed (AGENT-H7, via `zonedDateKey`).
 */
export function deriveChipTone(
  event: ChipToneEvent,
  today: string,
  slice?: ChipToneSlice,
  timeZone: string = DEFAULT_TZ,
): ChipTone {
  if (event.status === 'done') return 'done';
  if (event.status === 'skipped') return 'skipped';

  const anchorDay = slice ? slice.day : zonedDateKey(event.startAt, timeZone);
  if (anchorDay > today) return 'future';
  if (anchorDay === today) return 'today';

  // anchorDay < today: overdue only once the occurrence has fully ended;
  // an occurrence that started in the past but ends today/later is still
  // active → today.
  const endDay = zonedDateKey(event.endAt, timeZone);
  return endDay < today ? 'overdue' : 'today';
}
