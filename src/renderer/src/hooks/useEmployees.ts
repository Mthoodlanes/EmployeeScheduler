import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EmployeesCreateRequest,
  EmployeesSetDepartmentsRequest,
  EmployeesUpdateOwnProfileRequest,
  EmployeesUpdateRequest,
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
