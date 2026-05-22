import type { components } from './api.generated';

export type DashboardContinueResponseV2 = components['schemas']['DashboardContinueResponseV2'];
export type DashboardFullPlanResponseV2 = components['schemas']['DashboardFullPlanResponseV2'];
export type DashboardProgressResponseV2 = components['schemas']['DashboardProgressResponseV2'];
export type DashboardReviewResponseV2 = components['schemas']['DashboardReviewResponseV2'];
export type DashboardTodayCompletionResponseV2 = components['schemas']['DashboardTodayCompletionResponseV2'];
export type DashboardTodayResponseV2 = components['schemas']['DashboardTodayResponseV2'];
export type DashboardWeeklyAdjustRequestV2 = components['schemas']['DashboardWeeklyAdjustRequestV2'];
export type DashboardWeeklyPlanResponseV2 = components['schemas']['DashboardWeeklyPlanResponseV2'];
export type EventConflictsRequestV2 = components['schemas']['EventConflictsRequestV2'];
export type EventConflictsResponseV2 = components['schemas']['EventConflictsResponseV2'];
export type EventWindowResponseV2 = components['schemas']['EventWindowResponseV2'];
export type LearningRecordListResponseV2 = components['schemas']['LearningRecordListResponseV2'];
export type OverviewResponseV2 = components['schemas']['OverviewResponseV2'];
export type PlanAdjustmentListResponseV2 = components['schemas']['PlanAdjustmentListResponseV2'];
export type PlanAdjustmentReadV2 = components['schemas']['PlanAdjustmentReadV2'];
export type PlanAdjustmentRejectRequestV2 = components['schemas']['PlanAdjustmentRejectRequestV2'];
export type PlanAutoGenerateRequestV2 = components['schemas']['PlanAutoGenerateRequestV2'];
export type PlanCreateRequestV2 = components['schemas']['PlanCreateRequestV2'];
export type PlanEventBulkDeleteRequestV2 = components['schemas']['PlanEventBulkDeleteRequestV2'];
export type PlanEventBulkDeleteResponseV2 = components['schemas']['PlanEventBulkDeleteResponseV2'];
export type PlanEventCreateRequestV2 = components['schemas']['PlanEventCreateRequestV2'];
export type PlanEventReadV2 = components['schemas']['PlanEventReadV2'];
export type PlanEventUpdateRequestV2 = components['schemas']['PlanEventUpdateRequestV2'];
export type PlanListResponseV2 = components['schemas']['PlanListResponseV2'];
export type PlanReadV2 = components['schemas']['PlanReadV2'];
export type PlanRegenerateRangeRequestV2 = components['schemas']['PlanRegenerateRangeRequestV2'];
export type PlanUpdateRequestV2 = components['schemas']['PlanUpdateRequestV2'];
export type ProfileGoalsResponseV2 = components['schemas']['ProfileGoalsResponseV2'];
export type ProfileGoalsUpdateRequestV2 = components['schemas']['ProfileGoalsUpdateRequestV2'];
export type ProfileInfoResponseV2 = components['schemas']['ProfileInfoResponseV2'];
export type ProfileInfoUpdateRequestV2 = components['schemas']['ProfileInfoUpdateRequestV2'];
export type ProgressDiagnosisResponseV2 = components['schemas']['ProgressDiagnosisResponseV2'];
export type ProgressTimeseriesResponseV2 = components['schemas']['ProgressTimeseriesResponseV2'];
export type ProgressWeaknessResponseV2 = components['schemas']['ProgressWeaknessResponseV2'];
export type RecommendationAcceptRequestV2 = components['schemas']['RecommendationAcceptRequestV2'];
export type RecommendationAcceptResponseV2 = components['schemas']['RecommendationAcceptResponseV2'];
export type RecommendationListResponseV2 = components['schemas']['RecommendationListResponseV2'];
export type RecommendationRejectRequestV2 = components['schemas']['RecommendationRejectRequestV2'];

export interface EventWindowFilters {
  readonly from: string;
  readonly to: string;
  readonly includePracticeBlocks?: boolean;
  readonly tz?: string;
}

export interface ProgressTimeseriesFilters {
  readonly from: string;
  readonly to: string;
  readonly granularity?: 'day' | 'week';
}

export interface RecommendationHistoryFilters {
  readonly from?: string;
  readonly to?: string;
}

export interface DashboardFullPlanFilters {
  readonly view: 'today' | 'week' | 'month';
  readonly anchorDate?: string;
}

export interface DashboardWeeklyPlanFilters {
  readonly anchorDate?: string;
}

export interface ProfileRecordsFilters {
  readonly page?: number;
  readonly size?: number;
  readonly kind?: string;
  readonly status?: string;
  readonly from?: string;
  readonly to?: string;
  readonly sessionId?: number;
}

export interface HomeStreamErrorFrame {
  readonly type: 'error';
  readonly code: string;
  readonly message: string;
}

export interface HomeStreamEventFrame {
  readonly type: 'event';
  readonly event: PlanEventReadV2;
}

export interface HomePlanGenerateDoneFrame {
  readonly type: 'done';
  readonly plan: PlanReadV2;
  readonly events: readonly PlanEventReadV2[];
  readonly eventCount: number;
  readonly llmCallId: number;
}

export interface HomePlanRegenerateDoneFrame {
  readonly type: 'done';
  readonly planId: number;
  readonly events: readonly PlanEventReadV2[];
  readonly eventCount: number;
  readonly llmCallId: number;
}

export type HomePlanGenerateStreamFrame =
  | HomeStreamEventFrame
  | HomePlanGenerateDoneFrame
  | HomeStreamErrorFrame;

export type HomePlanRegenerateStreamFrame =
  | HomeStreamEventFrame
  | HomePlanRegenerateDoneFrame
  | HomeStreamErrorFrame;
