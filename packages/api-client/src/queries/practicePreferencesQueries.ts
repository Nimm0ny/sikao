import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { api } from '../request';
import type {
  CustomPracticeDefaults,
  PracticePreferencesPatchRequestV2,
  PracticePreferencesPutRequestV2,
  PracticePreferencesResetRequestV2,
  PracticePreferencesResponseV2,
  PracticePreferencesWriteResponseV2,
} from '../types/practice';

export const CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION = 1;

export const practicePreferencesKeys = {
  all: ['practice-preferences-v2'] as const,
  detail: () => ['practice-preferences-v2', 'detail'] as const,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flattenPatchEntries(prefix: string, value: unknown): PracticePreferencesPatchRequestV2['patches'] {
  if (!isRecord(value)) {
    return [{ path: prefix, value }];
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    throw new Error(`Cannot PATCH empty object at ${prefix}`);
  }
  return entries.flatMap(([key, child]) => flattenPatchEntries(`${prefix}.${key}`, child));
}

export function buildCustomPracticePatchRequest(
  customPractice: CustomPracticeDefaults,
  schemaVersion = CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
): PracticePreferencesPatchRequestV2 {
  return {
    schemaVersion,
    patches: flattenPatchEntries('customPractice', customPractice),
  };
}

export function fetchPracticePreferences(): Promise<PracticePreferencesResponseV2> {
  return api.get<PracticePreferencesResponseV2>('/profile/practice-preferences');
}

export function putPracticePreferences(
  payload: PracticePreferencesPutRequestV2,
): Promise<PracticePreferencesWriteResponseV2> {
  return api.put<PracticePreferencesWriteResponseV2, PracticePreferencesPutRequestV2>(
    '/profile/practice-preferences',
    payload,
  );
}

export function patchPracticePreferences(
  payload: PracticePreferencesPatchRequestV2,
): Promise<PracticePreferencesWriteResponseV2> {
  return api.patch<PracticePreferencesWriteResponseV2, PracticePreferencesPatchRequestV2>(
    '/profile/practice-preferences',
    payload,
  );
}

export function patchCustomPracticePreferences(
  customPractice: CustomPracticeDefaults,
  schemaVersion = CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
): Promise<PracticePreferencesWriteResponseV2> {
  return patchPracticePreferences(buildCustomPracticePatchRequest(customPractice, schemaVersion));
}

export function resetPracticePreferences(
  payload: PracticePreferencesResetRequestV2,
): Promise<PracticePreferencesWriteResponseV2> {
  return api.post<PracticePreferencesWriteResponseV2, PracticePreferencesResetRequestV2>(
    '/profile/practice-preferences/reset',
    payload,
  );
}

export function usePracticePreferences(): UseQueryResult<PracticePreferencesResponseV2> {
  return useQuery<PracticePreferencesResponseV2>({
    queryKey: practicePreferencesKeys.detail(),
    queryFn: fetchPracticePreferences,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function usePutPracticePreferences(): UseMutationResult<
  PracticePreferencesWriteResponseV2,
  unknown,
  PracticePreferencesPutRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation<PracticePreferencesWriteResponseV2, unknown, PracticePreferencesPutRequestV2>({
    mutationFn: putPracticePreferences,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: practicePreferencesKeys.all });
    },
  });
}

export function usePatchPracticePreferences(): UseMutationResult<
  PracticePreferencesWriteResponseV2,
  unknown,
  PracticePreferencesPatchRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation<PracticePreferencesWriteResponseV2, unknown, PracticePreferencesPatchRequestV2>({
    mutationFn: patchPracticePreferences,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: practicePreferencesKeys.all });
    },
  });
}

export function useResetPracticePreferences(): UseMutationResult<
  PracticePreferencesWriteResponseV2,
  unknown,
  PracticePreferencesResetRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation<PracticePreferencesWriteResponseV2, unknown, PracticePreferencesResetRequestV2>({
    mutationFn: resetPracticePreferences,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: practicePreferencesKeys.all });
    },
  });
}
