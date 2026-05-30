import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

export type SupportedRecommendationActionType =
  | 'review'
  | 'continue'
  | 'rest'
  | 'review_session';

export interface RecommendationVisualSpec {
  readonly kind: 'k-practice' | 'k-review' | 'k-rest';
  readonly icon: 'nav-practice' | 'nav-review' | 'nav-home';
}

interface BuildOptimisticPlanEventInput {
  readonly actionType: string;
  readonly eventId: number;
  readonly title: string;
  readonly reason: string;
  readonly estimatedMinutes: number;
  readonly targetDate: string;
  readonly payload: Record<string, unknown> | undefined;
}

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function formatShanghaiIso(date: Date): string {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  const hours = String(shifted.getUTCHours()).padStart(2, '0');
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
  const seconds = String(shifted.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
}

function parseSupportedActionType(actionType: string): SupportedRecommendationActionType {
  switch (actionType) {
    case 'review':
    case 'continue':
    case 'rest':
    case 'review_session':
      return actionType;
    default:
      throw new Error(`Unsupported recommendation actionType: ${actionType}`);
  }
}

function resolvePlanCategory(
  actionType: SupportedRecommendationActionType,
  payload: Record<string, unknown> | undefined,
): string {
  const template = payload?.session_template;
  if (typeof template === 'object' && template !== null) {
    const category = (template as { category?: unknown }).category;
    if (typeof category === 'string' && category.length > 0) {
      return category;
    }
  }
  return actionType === 'rest' ? 'break' : 'custom';
}

export function recommendationVisualSpec(actionType: string): RecommendationVisualSpec {
  switch (parseSupportedActionType(actionType)) {
    case 'continue':
      return { kind: 'k-practice', icon: 'nav-practice' };
    case 'review':
    case 'review_session':
      return { kind: 'k-review', icon: 'nav-review' };
    case 'rest':
      return { kind: 'k-rest', icon: 'nav-home' };
  }
}

export function buildRecommendationPlanOptimisticEvent(
  input: BuildOptimisticPlanEventInput,
): PlanEventReadV2 {
  const actionType = parseSupportedActionType(input.actionType);
  const start = new Date(`${input.targetDate}T18:00:00+08:00`);
  const end = new Date(start.getTime() + input.estimatedMinutes * 60 * 1000);

  return {
    id: String(input.eventId),
    title: input.title,
    notes: input.reason,
    category: resolvePlanCategory(actionType, input.payload),
    startAt: formatShanghaiIso(start),
    endAt: formatShanghaiIso(end),
    timezone: 'Asia/Shanghai',
    status: 'planned',
    source: 'ai_generated',
    planId: 0,
    isRecurringInstance: false,
    deletedAt: null,
    linkedSessionId: null,
    parentId: null,
    recurringExceptionDates: [],
    recurringParentId: null,
    recurringRule: null,
    targetId: null,
  };
}
