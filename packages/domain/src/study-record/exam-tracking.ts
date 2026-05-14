// User-side exam tracking — localStorage 持久 (无后端契约). 用 slug 当 key.
//
// 设计选择:
//   - slug 而非 id: id 在 backend reseed 后会变, slug 稳定 (见 ExamEvent.slug
//     注释).
//   - localStorage 而非 React Query: tracking 是 client-only 偏好, 没必要
//     server round-trip; 单设备体验在公考备考场景足够 (跨设备同步可推 P2).
//   - 函数式 API + storage event: 不暴露 hook, 让 view 选择自己 mount/poll
//     方式; 后续若有需要再加 useTrackedExams hook.

import { logger } from '@sikao/shared-utils';

const STORAGE_KEY = 'sikao.exam.tracking';

function readSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw === '') return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const slugs = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
    return new Set(slugs);
  } catch (error) {
    // FAIL-FAST EXCEPTION (lhr authorized 2026-05-08): localStorage tracking 是
    // client-only 用户偏好 (非业务正确性数据), corruption 时 self-heal 比让
    // ExamCalendar / ExamCountdownCard 整个崩更符合"图书馆隔壁桌"调性。
    // Registered: docs/engineering/fail-fast-exceptions.md#exam-tracking-self-heal
    logger.warn('exam-tracking: corrupted localStorage detected, self-healing', {
      error: error instanceof Error ? error.message : String(error),
      storageKey: STORAGE_KEY,
    });
    window.localStorage.removeItem(STORAGE_KEY);
    return new Set();
  }
}

function writeSet(set: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function getTrackedExamSlugs(): ReadonlySet<string> {
  return readSet();
}

export function isTrackedExam(slug: string): boolean {
  return readSet().has(slug);
}

/** Toggle. Returns new tracked state for the slug (true = now tracked). */
export function toggleTrackedExam(slug: string): boolean {
  const set = readSet();
  if (set.has(slug)) {
    set.delete(slug);
    writeSet(set);
    return false;
  }
  set.add(slug);
  writeSet(set);
  return true;
}

export function clearTrackedExams(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
