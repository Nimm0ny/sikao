import { describe, it, expect } from 'vitest';
import {
  daysUntil,
  nextExam,
  phaseOf,
  pickNextExamWithTracking,
  sortByUpcoming,
  urgencyOf,
  type ExamEvent,
} from '../exam-calendar';

const fakeNow = new Date('2026-04-28T10:00:00');

let _mkEventCounter = 0;

const mkEvent = (
  slug: string,
  examDate: string,
  extra: Partial<ExamEvent> = {},
): ExamEvent => ({
  id: ++_mkEventCounter,  // unique per call (stable id 不重要 — 测试用 slug)
  slug,
  name: slug,
  category: 'national',
  examDate,
  precision: 'estimate',
  ...extra,
});

describe('daysUntil', () => {
  it('counts whole days from now to a future date', () => {
    expect(daysUntil('2026-04-30', fakeNow)).toBe(2);
  });

  it('returns 0 for today', () => {
    expect(daysUntil('2026-04-28', fakeNow)).toBe(0);
  });

  it('returns negative for past dates', () => {
    expect(daysUntil('2026-04-25', fakeNow)).toBe(-3);
  });

  it('handles month boundaries (April → May, 30-day month)', () => {
    expect(daysUntil('2026-05-01', fakeNow)).toBe(3);
  });

  it('handles cross-year (Apr 2026 → Mar 2027)', () => {
    // 2026-04-28 → 2027-03-21 = 327 days (inclusive arithmetic)
    expect(daysUntil('2027-03-21', fakeNow)).toBe(327);
  });
});

describe('urgencyOf', () => {
  it.each([
    [-1, 'past'],
    [0, 'imminent'],
    [7, 'imminent'],
    [8, 'soon'],
    [30, 'soon'],
    [31, 'distant'],
    [365, 'distant'],
  ])('days=%d → %s', (days, expected) => {
    expect(urgencyOf(days)).toBe(expected);
  });
});

describe('phaseOf', () => {
  const event: ExamEvent = mkEvent('x', '2026-12-06', {
    registrationStart: '2026-10-15',
    registrationEnd: '2026-10-24',
  });

  it('past → past', () => {
    const past = mkEvent('x', '2026-04-01');
    expect(phaseOf(past, fakeNow)).toBe('past');
  });

  it('within 7 days → imminent (overrides registration)', () => {
    const soon = mkEvent('x', '2026-05-02', {
      registrationStart: '2026-04-01',
      registrationEnd: '2026-04-15',
    });
    expect(phaseOf(soon, fakeNow)).toBe('imminent');
  });

  it('before registration window → before-registration', () => {
    expect(phaseOf(event, fakeNow)).toBe('before-registration');
  });

  it('inside registration window → registration-open', () => {
    const insideWindow = new Date('2026-10-20T10:00:00');
    expect(phaseOf(event, insideWindow)).toBe('registration-open');
  });

  it('after registration end + still distant → preparation', () => {
    const afterReg = new Date('2026-11-01T10:00:00');
    expect(phaseOf(event, afterReg)).toBe('preparation');
  });

  it('no registration window + distant → preparation', () => {
    const noReg = mkEvent('x', '2027-12-05');
    expect(phaseOf(noReg, fakeNow)).toBe('preparation');
  });
});

describe('sortByUpcoming', () => {
  it('puts upcoming first (closest first), then past (most-recent first)', () => {
    const events = [
      mkEvent('past-old', '2024-01-01'),
      mkEvent('future-far', '2027-12-05'),
      mkEvent('past-recent', '2026-03-22'),
      mkEvent('future-near', '2026-12-06'),
    ];
    const sorted = sortByUpcoming(events, fakeNow);
    expect(sorted.map((e) => e.slug)).toEqual([
      'future-near',
      'future-far',
      'past-recent',
      'past-old',
    ]);
  });
});

describe('nextExam', () => {
  it('returns the closest upcoming event', () => {
    const events = [
      mkEvent('past', '2024-01-01'),
      mkEvent('future-far', '2027-12-05'),
      mkEvent('future-near', '2026-12-06'),
    ];
    expect(nextExam(events, fakeNow)?.slug).toBe('future-near');
  });

  it('returns null when all events are past', () => {
    const events = [mkEvent('past1', '2025-01-01'), mkEvent('past2', '2024-12-01')];
    expect(nextExam(events, fakeNow)).toBeNull();
  });
});

describe('pickNextExamWithTracking', () => {
  const events = [
    mkEvent('national', '2026-12-06'),
    mkEvent('provincial', '2026-08-10'),
    mkEvent('institution', '2027-03-15'),
  ];

  it('no tracked → fallback 默认 nextExam (closest upcoming)', () => {
    const result = pickNextExamWithTracking(events, new Set(), fakeNow);
    expect(result?.slug).toBe('provincial');
  });

  it('tracked 含 1 个未来 → 选 tracked 的', () => {
    const result = pickNextExamWithTracking(events, new Set(['national']), fakeNow);
    expect(result?.slug).toBe('national');
  });

  it('tracked 含多个 → 选 tracked 里最近的', () => {
    const result = pickNextExamWithTracking(
      events,
      new Set(['national', 'institution']),
      fakeNow,
    );
    expect(result?.slug).toBe('national');
  });

  it('tracked 全过期 → fallback 全集 nextExam', () => {
    const stale = [
      mkEvent('past-tracked', '2024-01-01'),
      mkEvent('future-others', '2026-12-06'),
    ];
    const result = pickNextExamWithTracking(stale, new Set(['past-tracked']), fakeNow);
    expect(result?.slug).toBe('future-others');
  });
});
