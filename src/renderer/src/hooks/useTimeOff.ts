import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  TimeOffCreateForEmployeeRequest,
  TimeOffCreateRequestRequest,
  TimeOffDecideRequest,
} from '@shared/types/ipc';
import { api } from '../api/client';

const OWN_TIME_OFF_KEY = ['timeOff', 'own'] as const;
const ALL_TIME_OFF_KEY = ['timeOff', 'all'] as const;
const APPROVED_RANGE_KEY_PREFIX = ['timeOff', 'approvedRange'] as const;

function approvedRangeKey(startDate: string, endDate: string) {
  return [...APPROVED_RANGE_KEY_PREFIX, startDate, endDate] as const;
}

export function useOwnTimeOffRequests() {
  return useQuery({
    queryKey: OWN_TIME_OFF_KEY,
    queryFn: () => api.timeOff.listOwn(),
  });
}

export function useAllTimeOffRequests() {
  return useQuery({
    queryKey: ALL_TIME_OFF_KEY,
    queryFn: () => api.timeOff.listAll(),
  });
}

/** Approved time off overlapping [startDate, endDate] — used to block days on the schedule grid. */
export function useApprovedTimeOffForRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: approvedRangeKey(startDate, endDate),
    queryFn: () => api.timeOff.listApprovedForRange({ startDate, endDate }),
  });
}

function invalidateTimeOffQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: OWN_TIME_OFF_KEY });
  queryClient.invalidateQueries({ queryKey: ALL_TIME_OFF_KEY });
  queryClient.invalidateQueries({ queryKey: APPROVED_RANGE_KEY_PREFIX });
}

export function useCreateTimeOffRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TimeOffCreateRequestRequest) => api.timeOff.createRequest(input),
    onSuccess: () => invalidateTimeOffQueries(queryClient),
  });
}

/** Manager-only: submit a request directly on behalf of any employee, auto-approved. */
export function useCreateTimeOffForEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TimeOffCreateForEmployeeRequest) => api.timeOff.createForEmployee(input),
    onSuccess: () => invalidateTimeOffQueries(queryClient),
  });
}

export function useDecideTimeOffRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TimeOffDecideRequest) => api.timeOff.decide(input),
    onSuccess: () => invalidateTimeOffQueries(queryClient),
  });
}
