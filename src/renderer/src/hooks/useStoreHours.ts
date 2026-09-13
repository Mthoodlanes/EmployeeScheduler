import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StoreHoursUpsertRequest } from '@shared/types/ipc';
import { api } from '../api/client';

const STORE_HOURS_KEY = ['storeHours'] as const;

/** The 7 weekly-default rows (fewer if not every day-of-week has been configured yet). */
export function useStoreHours() {
  return useQuery({
    queryKey: STORE_HOURS_KEY,
    queryFn: () => api.storeHours.list(),
  });
}

export function useUpsertStoreHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StoreHoursUpsertRequest) => api.storeHours.upsert(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STORE_HOURS_KEY }),
  });
}
