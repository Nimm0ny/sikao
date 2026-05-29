/*
 * buildProposedEvent tests — SIK-139 W3.
 *
 * Why: pin the field mapping the conflict check depends on — shifted times
 *      come from the drop, descriptive fields from the dragged event, and a
 *      recurring rule is preserved (so the server expands occurrences) but
 *      omitted when absent.
 */
import { describe, it, expect } from 'vitest';

import { buildProposedEvent } from './proposedEvent';

describe('buildProposedEvent', () => {
  const times = {
    startAt: '2026-05-18T01:00:00.000Z',
    endAt: '2026-05-18T02:00:00.000Z',
  };

  it('combines shifted times with the dragged event descriptive fields', () => {
    const proposed = buildProposedEvent(
      { title: '专项练习', category: 'practice', timezone: 'Asia/Shanghai' },
      times,
      'Asia/Shanghai',
    );
    expect(proposed).toEqual({
      title: '专项练习',
      category: 'practice',
      startAt: times.startAt,
      endAt: times.endAt,
      timezone: 'Asia/Shanghai',
    });
  });

  it('preserves a recurring rule so the server expands occurrences', () => {
    const proposed = buildProposedEvent(
      { title: '每日复盘', category: 'plan', timezone: 'Asia/Shanghai', recurringRule: 'FREQ=DAILY' },
      times,
      'Asia/Shanghai',
    );
    expect(proposed.recurringRule).toBe('FREQ=DAILY');
  });

  it('omits recurringRule when the dragged event has none', () => {
    const proposed = buildProposedEvent(
      { title: '专项练习', category: 'practice', recurringRule: null },
      times,
      'Asia/Shanghai',
    );
    expect('recurringRule' in proposed).toBe(false);
  });

  it('falls back to the calendar zone only when the event carries no timezone', () => {
    const proposed = buildProposedEvent(
      { title: '专项练习', category: 'practice', timezone: null },
      times,
      'Asia/Shanghai',
    );
    expect(proposed.timezone).toBe('Asia/Shanghai');
  });
});
