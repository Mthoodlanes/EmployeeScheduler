import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  PreferencesCreateRequest,
  PreferencesCreateResponse,
  PreferencesListAllResponse,
  PreferencesListForEmployeeRequest,
  PreferencesListForEmployeeResponse,
  PreferencesRemoveRequest,
  PreferencesRemoveResponse,
  PreferencesUpdateRequest,
  PreferencesUpdateResponse,
} from '../../shared/types/ipc';
import type { Employee } from '../../shared/types/domain';
import * as preferenceService from '../services/preferenceService';
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

export function registerPreferencesIpc(): void {
  // Reads are available to any logged-in user — the schedule grid's soft
  // preference indicator needs this regardless of who is viewing it.
  ipcMain.handle(IpcChannels.preferencesListAll, () =>
    toIpcResult<PreferencesListAllResponse>(() => {
      requireLoggedIn();
      return preferenceService.listAllPreferences();
    }),
  );

  ipcMain.handle(
    IpcChannels.preferencesListForEmployee,
    (_event, request: PreferencesListForEmployeeRequest) =>
      toIpcResult<PreferencesListForEmployeeResponse>(() => {
        requireLoggedIn();
        return preferenceService.listPreferencesForEmployee(request.employeeId);
      }),
  );

  // Writes are manager-only: preferences are manager-entered, not self-service.
  ipcMain.handle(IpcChannels.preferencesCreate, (_event, request: PreferencesCreateRequest) =>
    toIpcResult<PreferencesCreateResponse>(() => {
      const actor = requireManager();
      return preferenceService.createPreference(actor, request);
    }),
  );

  ipcMain.handle(IpcChannels.preferencesUpdate, (_event, request: PreferencesUpdateRequest) =>
    toIpcResult<PreferencesUpdateResponse>(() => {
      const actor = requireManager();
      return preferenceService.updatePreference(actor, request);
    }),
  );

  ipcMain.handle(IpcChannels.preferencesRemove, (_event, request: PreferencesRemoveRequest) =>
    toIpcResult<PreferencesRemoveResponse>(() => {
      const actor = requireManager();
      preferenceService.removePreference(actor, request.id);
      return { success: true };
    }),
  );
}
