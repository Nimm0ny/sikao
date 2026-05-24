import type { components, operations } from './api.generated';

type JsonContent<T> = T extends { content: { 'application/json': infer R } } ? R : never;
type SuccessResponse<T> =
  T extends { responses: { 200: infer R } } ? JsonContent<R> :
  T extends { responses: { 201: infer R } } ? JsonContent<R> :
  T extends { responses: { 202: infer R } } ? JsonContent<R> :
  never;
type RequestBody<T> = T extends { requestBody: { content: { 'application/json': infer B } } } ? B : never;
type QueryParams<T> = T extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;

export type ActionLinkV2 = components['schemas']['ActionLinkV2'];
export type AiQuestionFeedbackRequestV2 = components['schemas']['AiQuestionFeedbackRequestV2'];
export type AiQuestionFeedbackResponseV2 = components['schemas']['AiQuestionFeedbackResponseV2'];
export type AiQuestionRequestDetailV2 = components['schemas']['AiQuestionRequestDetailV2'];
export type AiQuestionsGenerateConfigV2 = components['schemas']['AiQuestionsGenerateConfigV2'];
export type AiQuestionsGenerateRequestV2 = components['schemas']['AiQuestionsGenerateRequestV2'];
export type AiQuestionsGenerateResponseV2 = components['schemas']['AiQuestionsGenerateResponseV2'];
export type AutoSavePreferences = components['schemas']['AutoSavePreferences'];
export type CustomPracticeDefaults = components['schemas']['CustomPracticeDefaults'];
export type DailyPracticeResponseV2 = components['schemas']['DailyPracticeResponseV2'];
export type EssayGradingResponseV2 = components['schemas']['EssayGradingResponseV2'];
export type EssayReferenceAnswerEnvelopeV2 = components['schemas']['EssayReferenceAnswerEnvelopeV2'];
export type EssayReferenceReportRequestV2 = components['schemas']['EssayReferenceReportRequestV2'];
export type KeyboardPreferences = components['schemas']['KeyboardPreferences'];
export type MockExamComparisonResponseV2 = components['schemas']['MockExamComparisonResponseV2'];
export type MockExamCountdownResponseV2 = components['schemas']['MockExamCountdownResponseV2'];
export type MockExamCreateRequestV2 = components['schemas']['MockExamCreateRequestV2'];
export type MockExamCreateResponseV2 = components['schemas']['MockExamCreateResponseV2'];
export type MockExamHistoryItem = components['schemas']['MockExamHistoryItem'];
export type MockExamHistoryResponseV2 = components['schemas']['MockExamHistoryResponseV2'];
export type OperationAckV2 = components['schemas']['OperationAckV2'];
export type PacingPreferences = components['schemas']['PacingPreferences'];
export type PracticeAnswerFlagRequestV2 = components['schemas']['PracticeAnswerFlagRequestV2'];
export type PracticeAnswerUpsertRequestV2 = components['schemas']['PracticeAnswerUpsertRequestV2'];
export type PracticeCenterResponseV2 = components['schemas']['PracticeCenterResponseV2'];
export type PracticePersistentFlagRequestV2 = components['schemas']['PracticePersistentFlagRequestV2'];
export type PracticePreferencesPatchItemV2 = components['schemas']['PracticePreferencesPatchItemV2'];
export type PracticePreferencesPatchRequestV2 = components['schemas']['PracticePreferencesPatchRequestV2'];
export type PracticePreferencesPayloadV1 = components['schemas']['PracticePreferencesPayloadV1'];
export type PracticePreferencesPayloadWireV1 = components['schemas']['PracticePreferencesPayloadWireV1'];
export type PracticePreferencesPutRequestV2 = components['schemas']['PracticePreferencesPutRequestV2'];
export type PracticePreferencesResetRequestV2 = components['schemas']['PracticePreferencesResetRequestV2'];
export type PracticePreferencesResponseV2 = components['schemas']['PracticePreferencesResponseV2'];
export type PracticePreferencesWriteResponseV2 = components['schemas']['PracticePreferencesWriteResponseV2'];
export type PracticeSessionCreateRequestV2 = components['schemas']['PracticeSessionCreateRequestV2'];
export type PracticeSessionEnvelopeV2 = components['schemas']['PracticeSessionEnvelopeV2'];
export type PracticeSessionItemV2 = components['schemas']['PracticeSessionItemV2'];
export type PracticeSessionResultResponseV2 = components['schemas']['PracticeSessionResultResponseV2'];
export type PracticeStatsCrossItemV2 = components['schemas']['PracticeStatsCrossItemV2'];
export type PracticeStatsCrossResponseV2 = components['schemas']['PracticeStatsCrossResponseV2'];
export type PracticeStatsPercentileResponseV2 = components['schemas']['PracticeStatsPercentileResponseV2'];
export type PracticeStatsResponseV2 = components['schemas']['PracticeStatsResponseV2'];
export type PracticeStatsTimingResponseV2 = components['schemas']['PracticeStatsTimingResponseV2'];
export type PracticeStatsTrendPointV2 = components['schemas']['PracticeStatsTrendPointV2'];
export type PracticeStatsTrendResponseV2 = components['schemas']['PracticeStatsTrendResponseV2'];
export type QuestionFavoriteCountV2 = components['schemas']['QuestionFavoriteCountV2'];
export type QuestionFavoriteCreateV2 = components['schemas']['QuestionFavoriteCreateV2'];
export type QuestionFavoriteItemV2 = components['schemas']['QuestionFavoriteItemV2'];
export type QuestionFavoriteListV2 = components['schemas']['QuestionFavoriteListV2'];
export type QuestionFlagCreateV2 = components['schemas']['QuestionFlagCreateV2'];
export type QuestionFlagItemV2 = components['schemas']['QuestionFlagItemV2'];
export type QuestionFlagListV2 = components['schemas']['QuestionFlagListV2'];
export type ReminderPreferences = components['schemas']['ReminderPreferences'];
export type SectionCardV2 = components['schemas']['SectionCardV2'];
export type SessionLifecycleResponseV2 = components['schemas']['SessionLifecycleResponseV2'];
export type SessionTimingReportV2 = components['schemas']['SessionTimingReportV2'];
export type SummaryMetricV2 = components['schemas']['SummaryMetricV2'];
export type TimingBaselineResponseV2 = components['schemas']['TimingBaselineResponseV2'];
export type TimingEventBatchAckV2 = components['schemas']['TimingEventBatchAckV2'];
export type TimingEventBatchRequestV2 = components['schemas']['TimingEventBatchRequestV2'];
export type TimingEventV2 = components['schemas']['TimingEventV2'];
export type UiPreferences = components['schemas']['UiPreferences'];

export type ActiveSessionsResponseV2 =
  SuccessResponse<operations['get_active_sessions_api_v2_practice_sessions_active_get']>;
export type ListDailyPracticeHistoryResponseV2 =
  SuccessResponse<operations['get_daily_practice_history_api_v2_practice_daily_history_get']>;
export type ListEssayCategoriesResponseV2 =
  SuccessResponse<operations['list_essay_categories_api_v2_practice_essay_categories_get']>;
export type ListEssayPapersResponseV2 =
  SuccessResponse<operations['list_essay_papers_api_v2_practice_essay_papers_get']>;
export type ListXingceCategoriesResponseV2 =
  SuccessResponse<operations['list_xingce_categories_api_v2_practice_xingce_categories_get']>;
export type ListXingcePapersResponseV2 =
  SuccessResponse<operations['list_xingce_papers_api_v2_practice_xingce_papers_get']>;
export type QuestionReportListResponseV2 =
  SuccessResponse<operations['get_question_reports_api_v2_practice_questions__question_id__reports_get']>;
export type QuestionReportEnvelopeV2 =
  SuccessResponse<operations['post_question_report_api_v2_practice_questions__question_id__reports_post']>;
export type QuestionReportCreateRequestV2 =
  RequestBody<operations['post_question_report_api_v2_practice_questions__question_id__reports_post']>;
export type QuestionReportUpdateRequestV2 =
  RequestBody<operations['patch_question_report_api_v2_practice_reports__report_id__patch']>;

export type PracticeStatsQuery = QueryParams<operations['get_practice_stats_api_v2_practice_stats_get']>;
export type PracticeStatsCrossQuery = QueryParams<operations['get_practice_stats_cross_api_v2_practice_stats_cross_get']>;
export type PracticeStatsPercentileQuery = QueryParams<operations['get_practice_stats_percentile_api_v2_practice_stats_percentile_get']>;
export type PracticeStatsRealtimeQuery = QueryParams<operations['get_practice_stats_realtime_api_v2_practice_stats_realtime_get']>;
export type PracticeStatsTimingQuery = QueryParams<operations['get_timing_stats_api_v2_practice_stats_timing_get']>;
export type PracticeStatsTrendQuery = QueryParams<operations['get_practice_stats_trend_api_v2_practice_stats_trend_get']>;
export type XingceCategoriesQuery = QueryParams<operations['list_xingce_categories_api_v2_practice_xingce_categories_get']>;
export type XingcePapersQuery = QueryParams<operations['list_xingce_papers_api_v2_practice_xingce_papers_get']>;
export type EssayCategoriesQuery = QueryParams<operations['list_essay_categories_api_v2_practice_essay_categories_get']>;
export type EssayPapersQuery = QueryParams<operations['list_essay_papers_api_v2_practice_essay_papers_get']>;
