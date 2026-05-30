import { describe, expect, it } from 'vitest';
import {
  buildRecommendationPlanOptimisticEvent,
  recommendationVisualSpec,
} from './recommendationActionType';

describe('recommendationActionType', () => {
  it('maps the current backend actionType contract and legacy review_session explicitly', () => {
    expect(recommendationVisualSpec('review')).toMatchObject({ kind: 'k-review', icon: 'nav-review' });
    expect(recommendationVisualSpec('continue')).toMatchObject({ kind: 'k-practice', icon: 'nav-practice' });
    expect(recommendationVisualSpec('rest')).toMatchObject({ kind: 'k-rest', icon: 'nav-home' });
    expect(recommendationVisualSpec('review_session')).toMatchObject({ kind: 'k-review', icon: 'nav-review' });
  });

  it('throws on unsupported actionType instead of silently falling back', () => {
    expect(() => recommendationVisualSpec('practice')).toThrowError(
      'Unsupported recommendation actionType: practice',
    );
  });

  it('builds an optimistic plan event aligned with backend accept(plan) defaults', () => {
    expect(
      buildRecommendationPlanOptimisticEvent({
        actionType: 'rest',
        eventId: 33,
        title: 'Reserve a short recovery block',
        reason: 'No higher-confidence practice card is available.',
        estimatedMinutes: 15,
        targetDate: '2026-06-02',
        payload: {},
      }),
    ).toMatchObject({
      id: '33',
      title: 'Reserve a short recovery block',
      category: 'break',
      notes: 'No higher-confidence practice card is available.',
      source: 'ai_generated',
      timezone: 'Asia/Shanghai',
      startAt: '2026-06-02T18:00:00+08:00',
      endAt: '2026-06-02T18:15:00+08:00',
    });
  });
});
