import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  ShiftTemplatesCreateRequest,
  ShiftTemplatesCreateResponse,
  ShiftTemplatesDeactivateRequest,
  ShiftTemplatesDeactivateResponse,
  ShiftTemplatesListResponse,
  ShiftTemplatesUpdateRequest,
  ShiftTemplatesUpdateResponse,
} from '../../shared/types/ipc';
import * as shiftTemplateService from '../services/shiftTemplateService';
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

export function registerShiftTemplatesIpc(): void {
  ipcMain.handle(IpcChannels.shiftTemplatesList, () =>
    toIpcResult<ShiftTemplatesListResponse>(() => {
      requireLoggedIn();
      return shiftTemplateService.listShiftTemplates();
    }),
  );

  ipcMain.handle(IpcChannels.shiftTemplatesCreate, (_event, request: ShiftTemplatesCreateRequest) =>
    toIpcResult<ShiftTemplatesCreateResponse>(() => {
      requireManager();
      return shiftTemplateService.createShiftTemplate(request);
    }),
  );

  ipcMain.handle(IpcChannels.shiftTemplatesUpdate, (_event, request: ShiftTemplatesUpdateRequest) =>
    toIpcResult<ShiftTemplatesUpdateResponse>(() => {
      requireManager();
      return shiftTemplateService.updateShiftTemplate(request);
    }),
  );

  ipcMain.handle(
    IpcChannels.shiftTemplatesDeactivate,
    (_event, request: ShiftTemplatesDeactivateRequest) =>
      toIpcResult<ShiftTemplatesDeactivateResponse>(() => {
        requireManager();
        return shiftTemplateService.deactivateShiftTemplate(request.id);
      }),
  );
}
