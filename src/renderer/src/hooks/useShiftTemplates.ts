import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ShiftTemplatesCreateRequest, ShiftTemplatesUpdateRequest } from '@shared/types/ipc';
import { api } from '../api/client';

const SHIFT_TEMPLATES_KEY = ['shiftTemplates'] as const;

export function useShiftTemplates() {
  return useQuery({
    queryKey: SHIFT_TEMPLATES_KEY,
    queryFn: () => api.shiftTemplates.list(),
  });
}

export function useCreateShiftTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ShiftTemplatesCreateRequest) => api.shiftTemplates.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIFT_TEMPLATES_KEY }),
  });
}

export function useUpdateShiftTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ShiftTemplatesUpdateRequest) => api.shiftTemplates.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIFT_TEMPLATES_KEY }),
  });
}

export function useDeactivateShiftTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.shiftTemplates.deactivate({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIFT_TEMPLATES_KEY }),
  });
}
