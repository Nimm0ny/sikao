import { describe, expect, it } from 'vitest';

import { parseQuestionHubContext } from '../useQuestionHub';

describe('parseQuestionHubContext', () => {
  it('parses a full review context payload', () => {
    const context = parseQuestionHubContext(
      new URLSearchParams(
        'ctx=review&review_id=11&session_id=12&note_id=13&topic_drill_seed=14&dim_focus=concept_confusion',
      ),
    );

    expect(context).toEqual({
      source: 'review',
      reviewId: 11,
      sessionId: 12,
      noteId: 13,
      topicDrillSeed: 14,
      dimFocus: 'concept_confusion',
    });
  });

  it('falls back to review when ctx is missing', () => {
    expect(parseQuestionHubContext(new URLSearchParams())).toMatchObject({
      source: 'review',
      reviewId: null,
      sessionId: null,
      noteId: null,
      topicDrillSeed: null,
      dimFocus: null,
    });
  });

  it('falls back to review when ctx is invalid', () => {
    expect(parseQuestionHubContext(new URLSearchParams('ctx=unknown'))).toMatchObject({
      source: 'review',
    });
  });

  it('keeps practice context values', () => {
    expect(parseQuestionHubContext(new URLSearchParams('ctx=practice&session_id=21'))).toMatchObject({
      source: 'practice',
      sessionId: 21,
    });
  });

  it('coerces non-numeric ids to null', () => {
    expect(
      parseQuestionHubContext(
        new URLSearchParams('review_id=abc&session_id=&note_id=nan&topic_drill_seed=x'),
      ),
    ).toMatchObject({
      reviewId: null,
      sessionId: null,
      noteId: null,
      topicDrillSeed: null,
    });
  });
});
