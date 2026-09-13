import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  EmployeesCreateRequest,
  EmployeesCreateResponse,
  EmployeesDeactivateRequest,
  EmployeesDeactivateResponse,
  EmployeesListResponse,
  EmployeesSetDepartmentsRequest,
  EmployeesSetDepartmentsResponse,
  EmployeesUpdateRequest,
  EmployeesUpdateResponse,
} from '../../shared/types/ipc';
import * as employeeService from '../services/employeeService';
import { session } from '../session';
import { toIpcResult, UnauthorizedError } from './ipcResult';

function requireLoggedIn(): void {
  if (!session.getCurrent()) {
    throw new UnauthorizedError('You must be logged in');
  }
}

function requireManager(): void {
  const current = session.getCurrent();
  if (!current || current.role !== 'manager') {
    throw new UnauthorizedError('Manager access required');
  }
}

export function registerEmployeesIpc(): void {
  ipcMain.handle(IpcChannels.employeesList, () =>
    toIpcResult<EmployeesListResponse>(() => {
      requireLoggedIn();
      return employeeService.listEmployees();
    }),
  );

  ipcMain.handle(IpcChannels.employeesCreate, (_event, request: EmployeesCreateRequest) =>
    toIpcResult<EmployeesCreateResponse>(() => {
      requireManager();
      return employeeService.createEmployee(request);
    }),
  );

  ipcMain.handle(IpcChannels.employeesUpdate, (_event, request: EmployeesUpdateRequest) =>
    toIpcResult<EmployeesUpdateResponse>(() => {
      requireManager();
      return employeeService.updateEmployee(request);
    }),
  );

  ipcMain.handle(IpcChannels.employeesDeactivate, (_event, request: EmployeesDeactivateRequest) =>
    toIpcResult<EmployeesDeactivateResponse>(() => {
      requireManager();
      return employeeService.deactivateEmployee(request.id);
    }),
  );

  ipcMain.handle(
    IpcChannels.employeesSetDepartments,
    (_event, request: EmployeesSetDepartmentsRequest) =>
      toIpcResult<EmployeesSetDepartmentsResponse>(() => {
        requireManager();
        return employeeService.setEmployeeDepartments(request.id, request.departments);
      }),
  );
}
