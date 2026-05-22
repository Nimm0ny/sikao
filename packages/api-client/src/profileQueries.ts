import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { homeQueryKeys } from './homeQueryKeys';
import { api } from './request';
import type {
  LearningRecordListResponseV2,
  ProfileGoalsResponseV2,
  ProfileGoalsUpdateRequestV2,
  ProfileInfoResponseV2,
  ProfileInfoUpdateRequestV2,
  ProfileRecordsFilters,
} from './types/home';

function invalidateProfileQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.profile.all() });
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.dashboard.all() });
}

export function fetchProfileInfo(): Promise<ProfileInfoResponseV2> {
  return api.get<ProfileInfoResponseV2>('/profile/info');
}

export function updateProfileInfo(
  payload: ProfileInfoUpdateRequestV2,
): Promise<ProfileInfoResponseV2> {
  return api.put<ProfileInfoResponseV2, ProfileInfoUpdateRequestV2>('/profile/info', payload);
}

export function fetchProfileGoals(): Promise<ProfileGoalsResponseV2> {
  return api.get<ProfileGoalsResponseV2>('/profile/goals');
}

export function updateProfileGoals(
  payload: ProfileGoalsUpdateRequestV2,
): Promise<ProfileGoalsResponseV2> {
  return api.put<ProfileGoalsResponseV2, ProfileGoalsUpdateRequestV2>('/profile/goals', payload);
}

export function fetchProfileRecords(
  filters: ProfileRecordsFilters = {},
): Promise<LearningRecordListResponseV2> {
  return api.get<LearningRecordListResponseV2>('/profile/records', {
    params: {
      page: filters.page,
      size: filters.size,
      kind: filters.kind,
      status: filters.status,
      from: filters.from,
      to: filters.to,
      session_id: filters.sessionId,
    },
  });
}

export function useProfileInfo(): UseQueryResult<ProfileInfoResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.profile.info(),
    queryFn: fetchProfileInfo,
  });
}

export function useProfileGoals(): UseQueryResult<ProfileGoalsResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.profile.goals(),
    queryFn: fetchProfileGoals,
  });
}

export function useProfileRecords(
  filters: ProfileRecordsFilters = {},
): UseQueryResult<LearningRecordListResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.profile.records(filters),
    queryFn: () => fetchProfileRecords(filters),
  });
}

export function useUpdateProfileInfo(): UseMutationResult<
  ProfileInfoResponseV2,
  unknown,
  ProfileInfoUpdateRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfileInfo,
    onSuccess: () => {
      invalidateProfileQueries(queryClient);
    },
  });
}

export function useUpdateProfileGoals(): UseMutationResult<
  ProfileGoalsResponseV2,
  unknown,
  ProfileGoalsUpdateRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfileGoals,
    onSuccess: () => {
      invalidateProfileQueries(queryClient);
    },
  });
}
