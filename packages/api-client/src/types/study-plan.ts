/**
 * Slice 3b · 学习计划相关类型 re-export.
 *
 * 增量引入策略 (plan D1=B): 老 src/types/api.d.ts 手写文件并行不动, 本 slice
 * 仅消费 api.generated.ts 中 study-plan 相关 narrow 类型. 后续 slice 增量迁.
 */
import type { components, paths } from './api.generated';

// ── outer / discriminated narrow ───────────────────────────────────────────

export type StudyPlanResponse = components['schemas']['StudyPlanResponse'];

export type PracticeTaskResponse = components['schemas']['PracticeTaskResponse'];
export type ReviewWrongTaskResponse =
  components['schemas']['ReviewWrongTaskResponse'];
export type EssayWritingTaskResponse =
  components['schemas']['EssayWritingTaskResponse'];

export type StudyTaskResponse = StudyPlanResponse['tasks'][number];

// ── history (Slice 3c) ─────────────────────────────────────────────────────

export type StudyPlanHistoryItemV2 =
  components['schemas']['StudyPlanHistoryItemV2'];
export type StudyPlanHistoryListV2 =
  components['schemas']['StudyPlanHistoryListV2'];

// ── PATCH / start request bodies ───────────────────────────────────────────

export type StudyTaskPatchRequest = components['schemas']['StudyTaskPatchRequest'];
export type StudyPlanStartPayload = components['schemas']['StudyPlanStartPayload'];

// ── start endpoint response (复用 PracticeSessionStartV2) ──────────────────

export type PracticeSessionStartV2 = components['schemas']['PracticeSessionStartV2'];

// ── path params ────────────────────────────────────────────────────────────

export type StudyPlanGetPath = paths['/api/v2/study-plan/today']['get'];
export type StudyTaskPatchPath =
  paths['/api/v2/study-plan/tasks/{task_id}']['patch'];
export type StudyPlanStartPath =
  paths['/api/v2/practice/study-plan/start']['post'];
export type StudyPlanHistoryPath =
  paths['/api/v2/study-plan/history']['get'];

// ── helpers ────────────────────────────────────────────────────────────────

export type GenerationStatus = StudyPlanResponse['generationStatus'];
export type StudyTaskStatus = StudyTaskResponse['status'];
export type StudyTaskKind = StudyTaskResponse['taskKind'];

/** Discriminator narrow helper. 用法: `if (isPracticeTask(task)) { task.payload.paperCode }` */
export function isPracticeTask(
  task: StudyTaskResponse,
): task is PracticeTaskResponse {
  return task.taskKind === 'practice';
}

export function isReviewWrongTask(
  task: StudyTaskResponse,
): task is ReviewWrongTaskResponse {
  return task.taskKind === 'review_wrong';
}

export function isEssayWritingTask(
  task: StudyTaskResponse,
): task is EssayWritingTaskResponse {
  return task.taskKind === 'essay_writing';
}
