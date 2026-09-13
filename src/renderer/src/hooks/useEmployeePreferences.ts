import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PreferencesCreateRequest, PreferencesUpdateRequest } from '@shared/types/ipc';
import { api } from '../api/client';

const PREFERENCES_KEY = ['preferences'] as const;

/** All employees' preference windows — used by the schedule grid's soft indicator. */
export function useEmployeePreferences() {
  return useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () => api.preferences.listAll(),
  });
}

function invalidatePreferenceQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY });
}

export function useCreatePreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PreferencesCreateRequest) => api.preferences.create(input),
    onSuccess: () => invalidatePreferenceQueries(queryClient),
  });
}

export function useUpdatePreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PreferencesUpdateRequest) => api.preferences.update(input),
    onSuccess: () => invalidatePreferenceQueries(queryClient),
  });
}

export function useRemovePreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.preferences.remove({ id }),
    onSuccess: () => invalidatePreferenceQueries(queryClient),
  });
}
