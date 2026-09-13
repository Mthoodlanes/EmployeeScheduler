import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EmployeesCreateRequest,
  EmployeesSetDepartmentsRequest,
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
