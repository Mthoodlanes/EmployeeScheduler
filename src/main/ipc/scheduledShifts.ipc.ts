import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  ScheduledShiftsAssignCustomRequest,
  ScheduledShiftsAssignCustomResponse,
  ScheduledShiftsAssignTemplateRequest,
  ScheduledShiftsAssignTemplateResponse,
  ScheduledShiftsListWeekRequest,
  ScheduledShiftsListWeekResponse,
  ScheduledShiftsOverrideRequest,
  ScheduledShiftsOverrideResponse,
  ScheduledShiftsRemoveRequest,
  ScheduledShiftsRemoveResponse,
} from '../../shared/types/ipc';
import * as scheduledShiftService from '../services/scheduledShiftService';
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

export function registerScheduledShiftsIpc(): void {
  // Reads are available to any logged-in user (managers build the schedule now;
  // employees will use the same channel in a later milestone to view their own shifts).
  ipcMain.handle(
    IpcChannels.scheduledShiftsListWeek,
    (_event, request: ScheduledShiftsListWeekRequest) =>
      toIpcResult<ScheduledShiftsListWeekResponse>(() => {
        requireLoggedIn();
        return scheduledShiftService.listWeek(request.department, request.weekStart);
      }),
  );

  ipcMain.handle(
    IpcChannels.scheduledShiftsAssignTemplate,
    (_event, request: ScheduledShiftsAssignTemplateRequest) =>
      toIpcResult<ScheduledShiftsAssignTemplateResponse>(() => {
        requireManager();
        return scheduledShiftService.assignTemplate(request);
      }),
  );

  ipcMain.handle(
    IpcChannels.scheduledShiftsAssignCustom,
    (_event, request: ScheduledShiftsAssignCustomRequest) =>
      toIpcResult<ScheduledShiftsAssignCustomResponse>(() => {
        requireManager();
        return scheduledShiftService.assignCustomShift(request);
      }),
  );

  ipcMain.handle(
    IpcChannels.scheduledShiftsOverride,
    (_event, request: ScheduledShiftsOverrideRequest) =>
      toIpcResult<ScheduledShiftsOverrideResponse>(() => {
        requireManager();
        return scheduledShiftService.overrideShift(request);
      }),
  );

  ipcMain.handle(
    IpcChannels.scheduledShiftsRemove,
    (_event, request: ScheduledShiftsRemoveRequest) =>
      toIpcResult<ScheduledShiftsRemoveResponse>(() => {
        requireManager();
        scheduledShiftService.removeShift(request.id);
        return { success: true };
      }),
  );
}
