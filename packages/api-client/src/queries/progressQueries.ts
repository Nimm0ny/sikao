/**
 * PR-6 + PR-8 MVP: progress dashboard queries + analytics event mutation.
 *
 * Endpoints:
 *   GET  /api/v2/progress/weekly          → WeeklyProgressSummaryV2
 *   GET  /api/v2/progress/accuracy-trend  → AccuracyTrendResponseV2
 *   POST /api/v2/analytics/event          → AnalyticsEventAckV2 (fire-and-forget)
 */
import {
  useMutation,
  useQuery,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { api } from '../request';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AccuracyTrendPoint {
  date: string;       // ISO date string
  accuracy: number;   // 0-100
  answered: number;
}

export interface AccuracyTrendResponse {
  days: number;
  points: AccuracyTrendPoint[];
}

export interface WeeklyProgressSummary {
  weekStart: string;
  weekEnd: string;
  xingceAnswered: number;
  xingceAccuracy: number;
  essaySubmitted: number;
  tasksCompleted: number;
  tasksTotal: number;
  streakDays: number;
}

export interface AnalyticsEventPayload {
  eventName: string;
  properties?: Record<string, string>;
  sessionId?: string;
}

// ── Query keys ────────────────────────────────────────────────────────────

export const progressKeys = {
  all: ['progress'] as const,
  weekly: () => ['progress', 'weekly'] as const,
  accuracyTrend: (days: number) => ['progress', 'accuracy-trend', days] as const,
} as const;

// ── Fetchers ──────────────────────────────────────────────────────────────

function fetchWeeklyProgress() {
  return api.get<WeeklyProgressSummary>('/progress/weekly', { timeout: 15_000 });
}

function fetchAccuracyTrend(days: number) {
  return api.get<AccuracyTrendResponse>(`/progress/accuracy-trend?days=${days}`, {
    timeout: 15_000,
  });
}

function postAnalyticsEvent(payload: AnalyticsEventPayload) {
  return api.post<{ received: boolean }, AnalyticsEventPayload>(
    '/analytics/event',
    payload,
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────

export function useWeeklyProgress(): UseQueryResult<WeeklyProgressSummary> {
  return useQuery({
    queryKey: progressKeys.weekly(),
    queryFn: fetchWeeklyProgress,
    staleTime: 5 * 60 * 1000,
    retry: (count, error) => {
      const status = (error as { status?: number })?.status;
      if (status && status >= 400 && status < 500) return false;
      return count < 2;
    },
  });
}

export function useAccuracyTrend(days: 7 | 30 | 90 | 180 = 30): UseQueryResult<AccuracyTrendResponse> {
  return useQuery({
    queryKey: progressKeys.accuracyTrend(days),
    queryFn: () => fetchAccuracyTrend(days),
    staleTime: 5 * 60 * 1000,
    retry: (count, error) => {
      const status = (error as { status?: number })?.status;
      if (status && status >= 400 && status < 500) return false;
      return count < 2;
    },
  });
}

export function useTrackEvent(): UseMutationResult<
  { received: boolean },
  unknown,
  AnalyticsEventPayload
> {
  return useMutation({
    mutationFn: postAnalyticsEvent,
  });
}
