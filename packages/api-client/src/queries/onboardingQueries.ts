/**
 * PR-1 MVP: onboarding status + goal/exam setup queries.
 *
 * Endpoints:
 *   GET /api/v2/me/onboarding-status  → OnboardingStatusV2
 *   GET /api/v2/me/goals              → UserGoalV2
 *   PUT /api/v2/me/goals              → UserGoalV2
 *   GET /api/v2/user-exams            → UserExamList
 *   POST /api/v2/user-exams           → UserExamRead
 *   GET /api/v2/exam-events           → ExamEventListResponse
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { api } from '../request';

// ── Types ─────────────────────────────────────────────────────────────────

export interface OnboardingStatus {
  hasGoal: boolean;
  hasExam: boolean;
  isOnboarded: boolean;
}

export interface UserGoal {
  hasGoal: boolean;
  targetScore: number | null;
}

export interface UserGoalUpdate {
  targetScore: number;
}

export interface ExamEvent {
  id: number;
  name: string;
  examDate: string;
  category: string;
  precision: string;
}

export interface ExamEventListResponse {
  items: ExamEvent[];
}

export interface UserExamCreate {
  name: string;
  examDate: string;
  examEventId?: number;
  notes?: string;
}

export interface UserExamRead {
  id: number;
  name: string;
  examDate: string;
  examEventId: number | null;
  notes: string | null;
}

export interface UserExamList {
  exams: UserExamRead[];
}

// ── Query keys ────────────────────────────────────────────────────────────

export const onboardingKeys = {
  status: () => ['onboarding', 'status'] as const,
  goal: () => ['me', 'goal'] as const,
  examEvents: () => ['exam-events'] as const,
  userExams: () => ['user-exams'] as const,
} as const;

// ── Hooks ─────────────────────────────────────────────────────────────────

export function useOnboardingStatus(): UseQueryResult<OnboardingStatus> {
  return useQuery({
    queryKey: onboardingKeys.status(),
    queryFn: () => api.get<OnboardingStatus>('/me/onboarding-status'),
    staleTime: 60 * 1000,
    retry: (count, error) => {
      const status = (error as { status?: number })?.status;
      if (status && status >= 400 && status < 500) return false;
      return count < 2;
    },
  });
}

export function useUserGoal(): UseQueryResult<UserGoal> {
  return useQuery({
    queryKey: onboardingKeys.goal(),
    queryFn: () => api.get<UserGoal>('/me/goals'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetUserGoal(): UseMutationResult<UserGoal, unknown, UserGoalUpdate> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserGoalUpdate) =>
      api.put<UserGoal, UserGoalUpdate>('/me/goals', payload),
    onSuccess: (data) => {
      qc.setQueryData(onboardingKeys.goal(), data);
      qc.invalidateQueries({ queryKey: onboardingKeys.status() });
    },
  });
}

export function useExamEvents(): UseQueryResult<ExamEventListResponse> {
  return useQuery({
    queryKey: onboardingKeys.examEvents(),
    queryFn: () => api.get<ExamEventListResponse>('/exam-events'),
    staleTime: 60 * 60 * 1000,
  });
}

export function useUserExams(): UseQueryResult<UserExamList> {
  return useQuery({
    queryKey: onboardingKeys.userExams(),
    queryFn: () => api.get<UserExamList>('/user-exams'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateUserExam(): UseMutationResult<UserExamRead, unknown, UserExamCreate> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserExamCreate) =>
      api.post<UserExamRead, UserExamCreate>('/user-exams', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: onboardingKeys.userExams() });
      qc.invalidateQueries({ queryKey: onboardingKeys.status() });
    },
  });
}
