import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  StoreHoursListResponse,
  StoreHoursUpsertRequest,
  StoreHoursUpsertResponse,
} from '../../shared/types/ipc';
import type { Employee } from '../../shared/types/domain';
import * as storeHoursService from '../services/storeHoursService';
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

export function registerStoreHoursIpc(): void {
  // Reads are available to any logged-in user — the schedule board needs
  // this regardless of who is viewing it.
  ipcMain.handle(IpcChannels.storeHoursList, () =>
    toIpcResult<StoreHoursListResponse>(() => {
      requireLoggedIn();
      return storeHoursService.listStoreHours();
    }),
  );

  // Writes are manager-only.
  ipcMain.handle(IpcChannels.storeHoursUpsert, (_event, request: StoreHoursUpsertRequest) =>
    toIpcResult<StoreHoursUpsertResponse>(() => {
      const actor = requireManager();
      return storeHoursService.upsertStoreHours(actor, request);
    }),
  );
}
