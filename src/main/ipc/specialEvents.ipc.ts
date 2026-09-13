import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  SpecialEventsCreateRequest,
  SpecialEventsCreateResponse,
  SpecialEventsListResponse,
  SpecialEventsRemoveRequest,
  SpecialEventsRemoveResponse,
  SpecialEventsUpdateRequest,
  SpecialEventsUpdateResponse,
} from '../../shared/types/ipc';
import type { Employee } from '../../shared/types/domain';
import * as specialEventService from '../services/specialEventService';
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

export function registerSpecialEventsIpc(): void {
  // Reads are available to any logged-in user — the schedule board needs
  // this regardless of who is viewing it.
  ipcMain.handle(IpcChannels.specialEventsList, () =>
    toIpcResult<SpecialEventsListResponse>(() => {
      requireLoggedIn();
      return specialEventService.listSpecialEvents();
    }),
  );

  // Writes are manager-only.
  ipcMain.handle(IpcChannels.specialEventsCreate, (_event, request: SpecialEventsCreateRequest) =>
    toIpcResult<SpecialEventsCreateResponse>(() => {
      const actor = requireManager();
      return specialEventService.createSpecialEvent(actor, request);
    }),
  );

  ipcMain.handle(IpcChannels.specialEventsUpdate, (_event, request: SpecialEventsUpdateRequest) =>
    toIpcResult<SpecialEventsUpdateResponse>(() => {
      const actor = requireManager();
      return specialEventService.updateSpecialEvent(actor, request);
    }),
  );

  ipcMain.handle(IpcChannels.specialEventsRemove, (_event, request: SpecialEventsRemoveRequest) =>
    toIpcResult<SpecialEventsRemoveResponse>(() => {
      const actor = requireManager();
      specialEventService.removeSpecialEvent(actor, request.id);
      return { success: true };
    }),
  );
}
