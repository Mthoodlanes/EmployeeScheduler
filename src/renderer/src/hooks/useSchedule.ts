import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Department } from '@shared/types/domain';
import type {
  ScheduledShiftsAssignCustomRequest,
  ScheduledShiftsAssignTemplateRequest,
  ScheduledShiftsCarryOverWeekRequest,
  ScheduledShiftsOverrideRequest,
} from '@shared/types/ipc';
import { api } from '../api/client';

/**
 * Exported so `useWeekOverlaps` can issue the same-shaped queries for all
 * three departments — sharing this exact key means a mutation's invalidation
 * below (scoped to one department + week) also refreshes the cross-
 * department overlap aggregate, with no separate invalidation path to keep
 * in sync.
 */
export function scheduleWeekKey(department: Department, weekStart: string) {
  return ['scheduledShifts', department, weekStart] as const;
}

export function useScheduleWeek(department: Department, weekStart: string) {
  return useQuery({
    queryKey: scheduleWeekKey(department, weekStart),
    queryFn: () => api.scheduledShifts.listWeek({ department, weekStart }),
  });
}

function publicationKey(department: Department, weekStart: string) {
  return ['schedulePublication', department, weekStart] as const;
}

export function useWeekPublication(department: Department, weekStart: string) {
  return useQuery({
    queryKey: publicationKey(department, weekStart),
    queryFn: () => api.scheduledShifts.getPublication({ department, weekStart }),
  });
}

export function usePublishWeek(department: Department, weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.scheduledShifts.publish({ department, weekStart }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: publicationKey(department, weekStart) }),
  });
}

export function useUnpublishWeek(department: Department, weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.scheduledShifts.unpublish({ department, weekStart }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: publicationKey(department, weekStart) }),
  });
}

export function useAssignShiftTemplate(department: Department, weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduledShiftsAssignTemplateRequest) =>
      api.scheduledShifts.assignTemplate(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: scheduleWeekKey(department, weekStart) }),
  });
}

export function useAssignCustomShift(department: Department, weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduledShiftsAssignCustomRequest) =>
      api.scheduledShifts.assignCustom(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: scheduleWeekKey(department, weekStart) }),
  });
}

export function useOverrideShift(department: Department, weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduledShiftsOverrideRequest) => api.scheduledShifts.override(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: scheduleWeekKey(department, weekStart) }),
  });
}

export function useRemoveShift(department: Department, weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.scheduledShifts.remove({ id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: scheduleWeekKey(department, weekStart) }),
  });
}

export function useCarryOverWeek(department: Department, weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ScheduledShiftsCarryOverWeekRequest, 'department' | 'targetWeekStart'>) =>
      api.scheduledShifts.carryOverWeek({ ...input, department, targetWeekStart: weekStart }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: scheduleWeekKey(department, weekStart) }),
  });
}
