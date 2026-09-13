import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EmployeesCreateRequest,
  EmployeesReorderRequest,
  EmployeesSetDepartmentsRequest,
  EmployeesUpdateOwnProfileRequest,
  EmployeesUpdateRequest,
  EmployeeWithDepartments,
} from '@shared/types/ipc';
import { api } from '../api/client';

const EMPLOYEES_KEY = ['employees'] as const;

export function useEmployees() {
  return useQuery({
    queryKey: EMPLOYEES_KEY,
    queryFn: () => api.employees.list(),
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeesCreateRequest) => api.employees.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeesUpdateRequest) => api.employees.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.employees.deactivate({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

export function useSetEmployeeDepartments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeesSetDepartmentsRequest) => api.employees.setDepartments(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

/**
 * Self-service counterpart to `useUpdateEmployee` — any logged-in user
 * (employee or manager) updating their OWN name/password via
 * `employees:updateOwnProfile` (IPC) / `PUT /api/employees/me` (HTTP). Also
 * invalidates the employees list, since a manager's own row appears there
 * too.
 */
export function useUpdateOwnProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeesUpdateOwnProfileRequest) => api.employees.updateOwnProfile(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

/**
 * Manager-only Schedule Board drag-and-drop reordering. `input.orderedIds`
 * must already be the COMPLETE merged order (see
 * `@shared/logic/employeeOrder`'s `mergeReorderedSubset`, used by
 * `ScheduleBoardPage` to fold a single department tab's drag result back
 * into the full list) — this hook does not do that merging itself.
 *
 * Optimistically reorders the cached employee list immediately (per the
 * feature plan) rather than waiting on the round trip, so the Schedule
 * Board's rows don't sit at the pre-drop position until the request
 * resolves; rolls back to the previous cached order if the request fails.
 */
export function useReorderEmployees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeesReorderRequest) => api.employees.reorder(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: EMPLOYEES_KEY });
      const previous = queryClient.getQueryData<EmployeeWithDepartments[]>(EMPLOYEES_KEY);
      if (previous) {
        const byId = new Map(previous.map((employee) => [employee.id, employee]));
        const reordered = input.orderedIds
          .map((id) => byId.get(id))
          .filter((employee): employee is EmployeeWithDepartments => employee !== undefined);
        queryClient.setQueryData(EMPLOYEES_KEY, reordered);
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(EMPLOYEES_KEY, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}
