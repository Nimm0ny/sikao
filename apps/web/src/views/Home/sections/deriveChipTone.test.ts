/*
 * deriveChipTone tests — SIK-142 W1 (visual contract §3.2).
 *
 * Why: tone is the chip's primary color channel (time-completion status,
 *      NOT event kind). The cascade done > skipped > overdue > today > future
 *      must stop at the first match, anchor on the occurrence's LOCAL day
 *      (Asia/Shanghai), and fail fast on an unparseable timestamp (H7).
 */
import { describe, it, expect } from 'vitest';

import { deriveChipTone, type ChipTone } from './deriveChipTone';

const TODAY = '2026-05-26';
const TZ = 'Asia/Shanghai';

// Local +08:00 builders so the test reads in the calendar zone, not UTC.
const at = (day: string, time = '09:00') => `${day}T${time}:00+08:00`;

interface ToneEvent {
  readonly status: string;
  readonly startAt: string;
  readonly endAt: string;
}

const ev = (over: Partial<ToneEvent> = {}): ToneEvent => ({
  status: 'planned',
  startAt: at(TODAY),
  endAt: at(TODAY, '10:30'),
  ...over,
});

describe('deriveChipTone cascade', () => {
  it('done wins over every time-based tone (even an overdue end)', () => {
    const tone = deriveChipTone(
      ev({ status: 'done', startAt: at('2026-05-01'), endAt: at('2026-05-02') }),
      TODAY,
      undefined,
      TZ,
    );
    expect(tone).toBe<ChipTone>('done');
  });

  it('skipped wins over overdue / today / future', () => {
    const tone = deriveChipTone(
      ev({ status: 'skipped', startAt: at('2026-05-01'), endAt: at('2026-05-02') }),
      TODAY,
      undefined,
      TZ,
    );
    expect(tone).toBe<ChipTone>('skipped');
  });

  it('overdue when the occurrence end local day is before today and not done/skipped', () => {
    const tone = deriveChipTone(
      ev({ status: 'in_progress', startAt: at('2026-05-20'), endAt: at('2026-05-25', '23:00') }),
      TODAY,
      undefined,
      TZ,
    );
    expect(tone).toBe<ChipTone>('overdue');
  });

  it('today when the occurrence start local day equals today', () => {
    expect(deriveChipTone(ev(), TODAY, undefined, TZ)).toBe<ChipTone>('today');
  });

  it('future when the occurrence start local day is after today', () => {
    const tone = deriveChipTone(
      ev({ startAt: at('2026-05-27'), endAt: at('2026-05-27', '10:00') }),
      TODAY,
      undefined,
      TZ,
    );
    expect(tone).toBe<ChipTone>('future');
  });
});

describe('deriveChipTone local-day anchoring (H7 borderline)', () => {
  it('uses Asia/Shanghai local day, not UTC, for the today boundary', () => {
    // 2026-05-26T00:30+08:00 == 2026-05-25T16:30Z. UTC would read 05-25
    // (yesterday) and mis-tag it; Shanghai local day is 05-26 = today.
    const tone = deriveChipTone(
      ev({ startAt: '2026-05-25T16:30:00.000Z', endAt: '2026-05-25T18:00:00.000Z' }),
      TODAY,
      undefined,
      TZ,
    );
    expect(tone).toBe<ChipTone>('today');
  });

  it('anchors today/future on slice.day for a cross-day slice', () => {
    // Occurrence spans 05-25..05-27; the slice rendered in the 05-27 cell
    // must read as future even though the occurrence STARTED on 05-25.
    const tone = deriveChipTone(
      ev({ status: 'planned', startAt: at('2026-05-25'), endAt: at('2026-05-27', '12:00') }),
      TODAY,
      { day: '2026-05-27' },
      TZ,
    );
    expect(tone).toBe<ChipTone>('future');
  });

  it('reads an active multi-day occurrence (start past, end today) as today', () => {
    const tone = deriveChipTone(
      ev({ status: 'in_progress', startAt: at('2026-05-24'), endAt: at(TODAY, '18:00') }),
      TODAY,
      undefined,
      TZ,
    );
    expect(tone).toBe<ChipTone>('today');
  });

  it('throws on an unparseable timestamp (no silent fallback, H7)', () => {
    expect(() =>
      deriveChipTone(ev({ startAt: 'not-a-date', endAt: 'not-a-date' }), TODAY, undefined, TZ),
    ).toThrow();
  });
});
