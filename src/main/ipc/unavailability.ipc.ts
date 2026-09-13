import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  UnavailabilityCreateForEmployeeRequest,
  UnavailabilityCreateForEmployeeResponse,
  UnavailabilityCreateOwnRequestRequest,
  UnavailabilityCreateOwnRequestResponse,
  UnavailabilityDecideRequest,
  UnavailabilityDecideResponse,
  UnavailabilityListAllResponse,
  UnavailabilityListApprovedAllResponse,
  UnavailabilityListOwnResponse,
} from '../../shared/types/ipc';
import type { Employee } from '../../shared/types/domain';
import * as unavailabilityService from '../services/unavailabilityService';
import { session } from '../session';
import { toIpcResult, UnauthorizedError } from './ipcResult';

/** Returns the current session's employee, or throws. Reads are gated on being logged in at all. */
function requireLoggedIn(): Employee {
  const current = session.getCurrent();
  if (!current) {
    throw new UnauthorizedError('You must be logged in');
  }
  return current;
}

/** Returns the current session's employee, or throws unless they are a manager. */
function requireManager(): Employee {
  const current = requireLoggedIn();
  if (current.role !== 'manager') {
    throw new UnauthorizedError('Manager access required');
  }
  return current;
}

export function registerUnavailabilityIpc(): void {
  // Any logged-in employee can submit and read their own unavailability
  // requests — the employee id always comes from the session, never from
  // the renderer-supplied request body.
  ipcMain.handle(
    IpcChannels.unavailabilityCreateOwnRequest,
    (_event, request: UnavailabilityCreateOwnRequestRequest) =>
      toIpcResult<UnavailabilityCreateOwnRequestResponse>(() => {
        const actor = requireLoggedIn();
        return unavailabilityService.createOwnRequest(actor, request);
      }),
  );

  ipcMain.handle(IpcChannels.unavailabilityListOwn, () =>
    toIpcResult<UnavailabilityListOwnResponse>(() => {
      const actor = requireLoggedIn();
      return unavailabilityService.listOwnRequests(actor);
    }),
  );

  // Manager-only: submit an entry directly on behalf of any employee,
  // auto-approved — see `unavailabilityService.createForEmployee`.
  ipcMain.handle(
    IpcChannels.unavailabilityCreateForEmployee,
    (_event, request: UnavailabilityCreateForEmployeeRequest) =>
      toIpcResult<UnavailabilityCreateForEmployeeResponse>(() => {
        const actor = requireManager();
        return unavailabilityService.createForEmployee(actor, request);
      }),
  );

  // Manager-only: the full approval queue and the approve/deny action.
  ipcMain.handle(IpcChannels.unavailabilityListAll, () =>
    toIpcResult<UnavailabilityListAllResponse>(() => {
      const actor = requireManager();
      return unavailabilityService.listAllRequests(actor);
    }),
  );

  ipcMain.handle(IpcChannels.unavailabilityDecide, (_event, request: UnavailabilityDecideRequest) =>
    toIpcResult<UnavailabilityDecideResponse>(() => {
      const actor = requireManager();
      return unavailabilityService.decideRequest(actor, request);
    }),
  );

  // Read-only, any logged-in user: used by the schedule grid to cross-
  // reference approved unavailability by employee + day-of-week.
  ipcMain.handle(IpcChannels.unavailabilityListApprovedAll, () =>
    toIpcResult<UnavailabilityListApprovedAllResponse>(() => {
      requireLoggedIn();
      return unavailabilityService.listApprovedAll();
    }),
  );
}
