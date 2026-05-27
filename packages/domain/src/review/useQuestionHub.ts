import { useMemo } from 'react';

import type { QuestionHubContext, ReviewTabContext } from './types';

const VALID_CONTEXTS: readonly ReviewTabContext[] = [
  'practice',
  'review',
  'note',
  'favorite',
  'home',
  'topic_drill',
];

function parseOptionalInt(value: string | null): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseQuestionHubContext(searchParams: URLSearchParams): QuestionHubContext {
  const sourceParam = searchParams.get('ctx');
  const source = VALID_CONTEXTS.includes(sourceParam as ReviewTabContext)
    ? (sourceParam as ReviewTabContext)
    : 'review';
  return {
    source,
    reviewId: parseOptionalInt(searchParams.get('review_id')),
    sessionId: parseOptionalInt(searchParams.get('session_id')),
    noteId: parseOptionalInt(searchParams.get('note_id')),
    topicDrillSeed: parseOptionalInt(searchParams.get('topic_drill_seed')),
    dimFocus: searchParams.get('dim_focus'),
  };
}

export function useQuestionHub(search: string | URLSearchParams = '') {
  const searchParams =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search;
  const context = useMemo(() => parseQuestionHubContext(searchParams), [searchParams]);

  return useMemo(
    () => ({
      context,
      source: context.source,
      reviewId: context.reviewId,
      sessionId: context.sessionId,
      noteId: context.noteId,
      topicDrillSeed: context.topicDrillSeed,
      dimFocus: context.dimFocus,
    }),
    [context],
  );
}
