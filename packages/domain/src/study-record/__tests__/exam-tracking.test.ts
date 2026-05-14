import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearTrackedExams,
  getTrackedExamSlugs,
  isTrackedExam,
  toggleTrackedExam,
} from '@sikao/domain/study-record/exam-tracking';
import { logger } from '@sikao/shared-utils';

const STORAGE_KEY = 'sikao.exam.tracking';

describe('exam-tracking', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty set when storage is empty', () => {
    expect(getTrackedExamSlugs().size).toBe(0);
    expect(isTrackedExam('exam-slug')).toBe(false);
  });

  it('toggles a slug on and off', () => {
    expect(toggleTrackedExam('national-2026')).toBe(true);
    expect(isTrackedExam('national-2026')).toBe(true);
    expect(toggleTrackedExam('national-2026')).toBe(false);
    expect(isTrackedExam('national-2026')).toBe(false);
  });

  it('filters non-string values out of stored array', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['a', 1, null, '', 'b']));
    const slugs = getTrackedExamSlugs();
    expect(slugs.has('a')).toBe(true);
    expect(slugs.has('b')).toBe(true);
    expect(slugs.size).toBe(2);
  });

  it('returns empty set when stored value is not an array (no self-heal needed)', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'array' }));
    expect(getTrackedExamSlugs().size).toBe(0);
    // Non-array is detected by Array.isArray check, no JSON.parse error → no self-heal.
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('self-heals when JSON is corrupted (clears storage + warns)', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');

    const slugs = getTrackedExamSlugs();

    expect(slugs.size).toBe(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [msg, ctx] = warnSpy.mock.calls[0]!;
    expect(msg).toContain('exam-tracking');
    expect(msg).toContain('self-healing');
    expect(ctx).toMatchObject({ storageKey: STORAGE_KEY });
  });

  it('clearTrackedExams removes the storage entry', () => {
    toggleTrackedExam('foo');
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    clearTrackedExams();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
