import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  TimeOffCreateForEmployeeRequest,
  TimeOffCreateForEmployeeResponse,
  TimeOffCreateRequestRequest,
  TimeOffCreateRequestResponse,
  TimeOffDecideRequest,
  TimeOffDecideResponse,
  TimeOffListAllResponse,
  TimeOffListApprovedForRangeRequest,
  TimeOffListApprovedForRangeResponse,
  TimeOffListOwnResponse,
} from '../../shared/types/ipc';
import type { Employee } from '../../shared/types/domain';
import * as timeOffService from '../services/timeOffService';
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

export function registerTimeOffIpc(): void {
  // Any logged-in employee can submit and read their own time-off requests —
  // the first employee-writable feature in the app. The employee id always
  // comes from the session, never from the renderer-supplied request body.
  ipcMain.handle(IpcChannels.timeOffCreateRequest, (_event, request: TimeOffCreateRequestRequest) =>
    toIpcResult<TimeOffCreateRequestResponse>(() => {
      const actor = requireLoggedIn();
      return timeOffService.createOwnRequest(actor, request);
    }),
  );

  ipcMain.handle(IpcChannels.timeOffListOwn, () =>
    toIpcResult<TimeOffListOwnResponse>(() => {
      const actor = requireLoggedIn();
      return timeOffService.listOwnRequests(actor);
    }),
  );

  // Manager-only: submit a request directly on behalf of any employee,
  // auto-approved — see `timeOffService.createForEmployee`.
  ipcMain.handle(
    IpcChannels.timeOffCreateForEmployee,
    (_event, request: TimeOffCreateForEmployeeRequest) =>
      toIpcResult<TimeOffCreateForEmployeeResponse>(() => {
        const actor = requireManager();
        return timeOffService.createForEmployee(actor, request);
      }),
  );

  // Manager-only: the full approval queue and the approve/deny action.
  ipcMain.handle(IpcChannels.timeOffListAll, () =>
    toIpcResult<TimeOffListAllResponse>(() => {
      const actor = requireManager();
      return timeOffService.listAllRequests(actor);
    }),
  );

  ipcMain.handle(IpcChannels.timeOffDecide, (_event, request: TimeOffDecideRequest) =>
    toIpcResult<TimeOffDecideResponse>(() => {
      const actor = requireManager();
      return timeOffService.decideRequest(actor, request);
    }),
  );

  // Read-only, any logged-in user: used by the schedule grid to block days
  // that already have approved time off, regardless of who is viewing.
  ipcMain.handle(
    IpcChannels.timeOffListApprovedForRange,
    (_event, request: TimeOffListApprovedForRangeRequest) =>
      toIpcResult<TimeOffListApprovedForRangeResponse>(() => {
        requireLoggedIn();
        return timeOffService.listApprovedForRange(request.startDate, request.endDate);
      }),
  );
}
