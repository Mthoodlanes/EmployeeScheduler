import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SpecialEventsCreateRequest, SpecialEventsUpdateRequest } from '@shared/types/ipc';
import { api } from '../api/client';

const SPECIAL_EVENTS_KEY = ['specialEvents'] as const;

/** Every special-event date override — used by both the admin page and the schedule board's day headers. */
export function useSpecialEvents() {
  return useQuery({
    queryKey: SPECIAL_EVENTS_KEY,
    queryFn: () => api.specialEvents.list(),
  });
}

function invalidateSpecialEventQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: SPECIAL_EVENTS_KEY });
}

export function useCreateSpecialEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SpecialEventsCreateRequest) => api.specialEvents.create(input),
    onSuccess: () => invalidateSpecialEventQueries(queryClient),
  });
}

export function useUpdateSpecialEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SpecialEventsUpdateRequest) => api.specialEvents.update(input),
    onSuccess: () => invalidateSpecialEventQueries(queryClient),
  });
}

export function useRemoveSpecialEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.specialEvents.remove({ id }),
    onSuccess: () => invalidateSpecialEventQueries(queryClient),
  });
}
