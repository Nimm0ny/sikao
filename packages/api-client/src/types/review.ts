import type { components, operations } from './api.generated';

type JsonContent<T> = T extends { content: { 'application/json': infer R } } ? R : never;
type SuccessResponse<T> =
  T extends { responses: { 200: infer R } } ? JsonContent<R> :
  T extends { responses: { 201: infer R } } ? JsonContent<R> :
  T extends { responses: { 202: infer R } } ? JsonContent<R> :
  never;
type RequestBody<T> = T extends { requestBody: { content: { 'application/json': infer B } } } ? B : never;
type QueryParams<T> = T extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;
type SafeQueryParams<T> = QueryParams<T> extends never ? Record<string, never> : QueryParams<T>;

export type ReviewConfidenceLevel = 'guess' | 'unsure' | 'likely' | 'certain';

export type ActionLinkV2 = components['schemas']['ActionLinkV2'];
export type CauseAnalysisComparisonJudgmentV2 = components['schemas']['CauseAnalysisComparisonJudgmentV2'];
export type CauseAnalysisDimensionOverrideV2 = components['schemas']['CauseAnalysisDimensionOverrideV2'];
export type CauseAnalysisDimensionV2 = components['schemas']['CauseAnalysisDimensionV2'];
export type CauseAnalysisEvolutionContextV2 = components['schemas']['CauseAnalysisEvolutionContextV2'];
export type CauseAnalysisFeedbackRequestV2 = components['schemas']['CauseAnalysisFeedbackRequestV2'];
export type CauseAnalysisGroupRequestV2 = components['schemas']['CauseAnalysisGroupRequestV2'];
export type CauseAnalysisRequestV2 = components['schemas']['CauseAnalysisRequestV2'];
export type CauseAnalysisResponseV2 = components['schemas']['CauseAnalysisResponseV2'];
export type CauseAnalysisResultV2 = components['schemas']['CauseAnalysisResultV2'];
export type CauseDimensionOverrideRequestV2 = components['schemas']['CauseDimensionOverrideRequestV2'];
export type CauseTagItemV2 = components['schemas']['CauseTagItemV2'];
export type CauseTagListResponseV2 = components['schemas']['CauseTagListResponseV2'];
export type DashboardReviewResponseV2 = components['schemas']['DashboardReviewResponseV2'];
export type OverviewResponseV2 = components['schemas']['OverviewResponseV2'];
export type ReviewAttemptOutV2 = components['schemas']['ReviewAttemptOutV2'];
export type ReviewAttemptSubmitV2 = components['schemas']['ReviewAttemptSubmitV2'];
export type ReviewBatchActionResultV2 = components['schemas']['ReviewBatchActionResultV2'];
export type ReviewCauseFrequencyV2 = components['schemas']['ReviewCauseFrequencyV2'];
export type ReviewDebtPlanBucketV2 = components['schemas']['ReviewDebtPlanBucketV2'];
export type ReviewDebtPlanResponseV2 = components['schemas']['ReviewDebtPlanResponseV2'];
export type ReviewDebtSnapshotResponseV2 = components['schemas']['ReviewDebtSnapshotResponseV2'];
export type ReviewDetailResponseV2 = components['schemas']['ReviewDetailResponseV2'];
export type ReviewInsightsCausesResponseV2 = components['schemas']['ReviewInsightsCausesResponseV2'];
export type ReviewInsightsDayPointV2 = components['schemas']['ReviewInsightsDayPointV2'];
export type ReviewInsightsRedoAccuracyResponseV2 = components['schemas']['ReviewInsightsRedoAccuracyResponseV2'];
export type ReviewInsightsTrendsResponseV2 = components['schemas']['ReviewInsightsTrendsResponseV2'];
export type ReviewItemBatchActionV2 = components['schemas']['ReviewItemBatchActionV2'];
export type ReviewItemCreateV2 = components['schemas']['ReviewItemCreateV2'];
export type ReviewItemV2 = components['schemas']['ReviewItemV2'];
export type ReviewListResponseV2 = components['schemas']['ReviewListResponseV2'];
export type ReviewWeekAccuracyPointV2 = components['schemas']['ReviewWeekAccuracyPointV2'];
export type ReviewWeeklyConcernHighlightV2 = components['schemas']['ReviewWeeklyConcernHighlightV2'];
export type ReviewWeeklyProgressHighlightV2 = components['schemas']['ReviewWeeklyProgressHighlightV2'];
export type ReviewWeeklySummaryResponseV2 = components['schemas']['ReviewWeeklySummaryResponseV2'];

export type ReviewItemsQuery = SafeQueryParams<operations['list_review_items_api_v2_review_items_get']>;
export type ReviewWeeklySummaryQuery =
  SafeQueryParams<operations['get_weekly_summary_api_v2_review_weekly_summary_get']>;
export type ReviewDebtPlanQuery =
  SafeQueryParams<operations['get_review_debt_plan_api_v2_review_debt_plan_get']>;
export type ReviewInsightsTrendsQuery =
  SafeQueryParams<operations['get_review_insights_trends_api_v2_review_insights_trends_get']>;
export type ReviewInsightsCausesQuery =
  SafeQueryParams<operations['get_review_insights_causes_api_v2_review_insights_causes_get']>;
export type ReviewInsightsRedoAccuracyQuery =
  SafeQueryParams<operations['get_review_insights_redo_accuracy_api_v2_review_insights_redo_accuracy_get']>;

export type ReviewItemReadV2 =
  SuccessResponse<operations['get_review_item_api_v2_review_items__item_id__get']>;
export type ReviewCreateResponseV2 =
  SuccessResponse<operations['create_review_item_api_v2_review_items_post']>;
export type ReviewGraduateResponseV2 =
  SuccessResponse<operations['graduate_item_api_v2_review_items__item_id__graduate_patch']>;
export type ReviewArchiveResponseV2 =
  SuccessResponse<operations['archive_item_api_v2_review_items__item_id__archive_patch']>;
export type ReviewRestoreResponseV2 =
  SuccessResponse<operations['restore_item_api_v2_review_items__item_id__restore_patch']>;
export type ReviewRedoResponseV2 =
  SuccessResponse<operations['redo_review_item_api_v2_review_items__item_id__redo_post']>;
export type ReviewAddToPlanResponseV2 =
  SuccessResponse<operations['add_review_item_to_plan_api_v2_review_items__item_id__add_to_plan_post']>;
export type ReviewAttemptResponseV2 =
  SuccessResponse<operations['attempt_review_item_api_v2_review_items__item_id__attempt_post']>;
export type ReviewBatchResponseV2 =
  SuccessResponse<operations['batch_action_api_v2_review_items_batch_post']>;
export type ReviewCauseAnalysisSingleResponseV2 =
  SuccessResponse<operations['create_cause_analysis_single_api_v2_review_items__item_id__cause_analysis_post']>;
export type ReviewCauseAnalysisGroupResponseV2 =
  SuccessResponse<operations['create_cause_analysis_group_api_v2_review_cause_analysis_group_post']>;
export type ReviewCauseAnalysisOverrideResponseV2 =
  SuccessResponse<
    operations['patch_cause_analysis_dimension_api_v2_review_cause_analysis__analysis_id__dimensions__dimension_index__patch']
  >;
export type ReviewCauseAnalysisFeedbackResponseV2 =
  SuccessResponse<
    operations['post_cause_analysis_feedback_api_v2_review_cause_analysis__analysis_id__feedback_post']
  >;

export type ReviewCreateRequestV2 =
  RequestBody<operations['create_review_item_api_v2_review_items_post']>;
export type ReviewBatchRequestV2 =
  RequestBody<operations['batch_action_api_v2_review_items_batch_post']>;
export type ReviewAttemptRequestV2 =
  RequestBody<operations['attempt_review_item_api_v2_review_items__item_id__attempt_post']>;
export type PracticeAnswerFeedItemV2 = components['schemas']['PracticeAnswerFeedItemV2'];
export type PracticeAnswerFeedResponseV2 = components['schemas']['PracticeAnswerFeedResponseV2'];
