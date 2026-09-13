import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UnavailabilityCreateForEmployeeRequest,
  UnavailabilityCreateOwnRequestRequest,
  UnavailabilityDecideRequest,
} from '@shared/types/ipc';
import { api } from '../api/client';

const OWN_UNAVAILABILITY_KEY = ['unavailability', 'own'] as const;
const ALL_UNAVAILABILITY_KEY = ['unavailability', 'all'] as const;
const APPROVED_UNAVAILABILITY_KEY = ['unavailability', 'approvedAll'] as const;

export function useOwnUnavailability() {
  return useQuery({
    queryKey: OWN_UNAVAILABILITY_KEY,
    queryFn: () => api.unavailability.listOwn(),
  });
}

export function useAllUnavailability() {
  return useQuery({
    queryKey: ALL_UNAVAILABILITY_KEY,
    queryFn: () => api.unavailability.listAll(),
  });
}

/** Approved unavailability across all employees — used to cross-reference the schedule grid. */
export function useApprovedUnavailability() {
  return useQuery({
    queryKey: APPROVED_UNAVAILABILITY_KEY,
    queryFn: () => api.unavailability.listApprovedAll(),
  });
}

function invalidateUnavailabilityQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: OWN_UNAVAILABILITY_KEY });
  queryClient.invalidateQueries({ queryKey: ALL_UNAVAILABILITY_KEY });
  queryClient.invalidateQueries({ queryKey: APPROVED_UNAVAILABILITY_KEY });
}

export function useCreateUnavailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UnavailabilityCreateOwnRequestRequest) =>
      api.unavailability.createOwnRequest(input),
    onSuccess: () => invalidateUnavailabilityQueries(queryClient),
  });
}

/** Manager-only: submit an entry directly on behalf of any employee, auto-approved. */
export function useCreateUnavailabilityForEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UnavailabilityCreateForEmployeeRequest) =>
      api.unavailability.createForEmployee(input),
    onSuccess: () => invalidateUnavailabilityQueries(queryClient),
  });
}

export function useDecideUnavailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UnavailabilityDecideRequest) => api.unavailability.decide(input),
    onSuccess: () => invalidateUnavailabilityQueries(queryClient),
  });
}
