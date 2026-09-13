import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  EmployeesCreateRequest,
  EmployeesCreateResponse,
  EmployeesDeactivateRequest,
  EmployeesDeactivateResponse,
  EmployeesListResponse,
  EmployeesReorderRequest,
  EmployeesReorderResponse,
  EmployeesSetDepartmentsRequest,
  EmployeesSetDepartmentsResponse,
  EmployeesUpdateOwnProfileRequest,
  EmployeesUpdateOwnProfileResponse,
  EmployeesUpdateRequest,
  EmployeesUpdateResponse,
} from '../../shared/types/ipc';
import type { Employee } from '../../shared/types/domain';
import * as employeeService from '../services/employeeService';
import { session } from '../session';
import { toIpcResult, UnauthorizedError } from './ipcResult';

/** Returns the current session's employee, or throws. Reads/self-service actions are gated on being logged in at all. */
function requireLoggedIn(): Employee {
  const current = session.getCurrent();
  if (!current) {
    throw new UnauthorizedError('You must be logged in');
  }
  return current;
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

  ipcMain.handle(IpcChannels.employeesReorder, (_event, request: EmployeesReorderRequest) =>
    toIpcResult<EmployeesReorderResponse>(() => {
      requireManager();
      return employeeService.reorderEmployees(request.orderedIds);
    }),
  );

  // Self-service: any logged-in user (employee or manager) may update their
  // OWN name/password. Never manager-gated — the actor id always comes from
  // the session, never from the renderer-supplied request body, and the
  // service layer refuses to touch role/departments/isSalaried/isActive.
  ipcMain.handle(
    IpcChannels.employeesUpdateOwnProfile,
    (_event, request: EmployeesUpdateOwnProfileRequest) =>
      toIpcResult<EmployeesUpdateOwnProfileResponse>(() => {
        const actor = requireLoggedIn();
        return employeeService.updateOwnProfile(actor.id, request);
      }),
  );
}
