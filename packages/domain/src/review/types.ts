import type {
  CauseAnalysisResponseV2,
  ReviewItemV2,
} from '@sikao/api-client/types/review';

export type ReviewTabContext =
  | 'practice'
  | 'review'
  | 'note'
  | 'favorite'
  | 'home'
  | 'topic_drill';

export interface QuestionHubContext {
  readonly source: ReviewTabContext;
  readonly reviewId: number | null;
  readonly sessionId: number | null;
  readonly noteId: number | null;
  readonly topicDrillSeed: number | null;
  readonly dimFocus: string | null;
}

export type SmartReviewCardType =
  | 'high_frequency_wrong'
  | 'long_unreviewed'
  | 'predicted_re_fail';

export interface SmartReviewCard {
  readonly type: SmartReviewCardType;
  readonly title: string;
  readonly subtitle: string;
  readonly count: number;
  readonly questionIds: readonly number[];
  readonly ctaLabel: string;
}

export interface RecentAnswerForAggregation {
  readonly questionId: number;
  readonly sessionId: number;
  readonly isCorrect: boolean | null;
  readonly answeredAt: string;
  readonly confidence: 'guess' | 'unsure' | 'likely' | 'certain' | null;
  readonly durationS: number | null;
}

export interface SmartReviewCardsResult {
  readonly cards: readonly SmartReviewCard[];
  readonly recommendedSessionLength: number;
}

export interface CauseAnalysisState {
  readonly analysis: CauseAnalysisResponseV2 | null;
  readonly latestQuestionIds: readonly number[];
}

export interface SmartReviewComputationInput {
  readonly items: readonly ReviewItemV2[];
  readonly recentAnswers: readonly RecentAnswerForAggregation[];
  readonly now?: Date;
}
