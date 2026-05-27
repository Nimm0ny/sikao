import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

/*
 * eventKind — V5 SIK-126 Calendar 4-tone kind palette.
 *
 * Why: Home v2.1 prototype uses 4 visual kinds for the calendar event
 *      tint, distinct from the backend `category` field which is a
 *      subject classifier (yanyu / shuliang / ...). The view layer maps
 *      the backend category string into one of:
 *
 *        - 'plan'      — generic study plan slot (default)
 *        - 'practice'  — intelligent / specialty practice
 *        - 'mock'      — full simulation exam
 *        - 'milestone' — exam / registration / deadline marker
 *
 *      Mapping is contained here so Today / Week / Month views share a
 *      single source. AGENT-H6 — define-first: any new backend category
 *      must map here explicitly, falling through to 'plan' so we never
 *      surface an unknown chip color.
 */

export type EventKind = 'plan' | 'practice' | 'mock' | 'milestone';

const PRACTICE_CATEGORIES = new Set(['practice', 'specialty', 'daily', 'review']);
const MOCK_CATEGORIES = new Set(['mock', 'mock_exam', 'simulation']);
const MILESTONE_CATEGORIES = new Set(['milestone', 'exam', 'registration', 'deadline']);

export function eventKindOf(event: PlanEventReadV2): EventKind {
  const cat = event.category;
  if (MILESTONE_CATEGORIES.has(cat)) return 'milestone';
  if (MOCK_CATEGORIES.has(cat)) return 'mock';
  if (PRACTICE_CATEGORIES.has(cat)) return 'practice';
  return 'plan';
}

export function eventKindLabel(kind: EventKind): string {
  switch (kind) {
    case 'plan': return '计划';
    case 'practice': return '练习';
    case 'mock': return '模考';
    case 'milestone': return '里程碑';
  }
}
