export interface StudyTaskPayload {
  readonly title: string;
  readonly subtitle?: string;
  readonly paperCode?: string | null;
  readonly questionIds?: readonly number[];
}

export interface StudyTaskResponse {
  readonly id: number;
  readonly taskKind: 'practice' | 'review_wrong' | 'essay_writing';
  readonly displayOrder: number;
  readonly status: 'pending' | 'completed' | 'skipped';
  readonly completedAt?: string | null;
  readonly payload: StudyTaskPayload;
}

export interface StudyPlanResponse {
  readonly id: number;
  readonly planDate: string;
  readonly generationStatus: 'success' | 'legacy_compat';
  readonly dailyQuota: number | null;
  readonly dailyAccuracyTarget: number | null;
  readonly tasks: readonly StudyTaskResponse[];
}

export interface StudyTaskPatchRequest {
  readonly status: 'completed' | 'skipped';
}

export interface StudyPlanHistoryItemV2 {
  readonly id: number;
  readonly planDate: string;
  readonly generationStatus: string;
  readonly taskTotal: number;
  readonly taskCompleted: number;
  readonly createdAt: string;
}

export interface StudyPlanHistoryListV2 {
  readonly items: readonly StudyPlanHistoryItemV2[];
  readonly nextCursor: string | null;
}

export interface StudyPlanStartPayload {
  readonly paperCode?: string | null;
  readonly questionIds: readonly number[];
}

export interface PracticeSessionStartV2 {
  readonly sessionId: string | number;
  readonly paperCode?: string | null;
  readonly paperRevisionId?: string | null;
  readonly paperName?: string | null;
  readonly sections: readonly unknown[];
  readonly savedAnswers: Record<string, string[]>;
}
