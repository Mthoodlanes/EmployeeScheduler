import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  CreateFirstManagerRequest,
  CreateFirstManagerResponse,
  FirstRunStatusResponse,
  GetSessionResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
} from '../../shared/types/ipc';
import * as authService from '../services/authService';
import { session } from '../session';
import { toIpcResult } from './ipcResult';

export function registerAuthIpc(): void {
  ipcMain.handle(IpcChannels.authLogin, (_event, request: LoginRequest) =>
    toIpcResult<LoginResponse>(() => {
      const employee = authService.login(request.username, request.password);
      session.login(employee);
      return employee;
    }),
  );

  ipcMain.handle(IpcChannels.authLogout, () =>
    toIpcResult<LogoutResponse>(() => {
      session.logout();
      return { success: true };
    }),
  );

  ipcMain.handle(IpcChannels.authGetSession, () =>
    toIpcResult<GetSessionResponse>(() => session.getCurrent()),
  );

  ipcMain.handle(IpcChannels.authFirstRunStatus, () =>
    toIpcResult<FirstRunStatusResponse>(() => ({ isFirstRun: authService.isFirstRun() })),
  );

  ipcMain.handle(IpcChannels.authCreateFirstManager, (_event, request: CreateFirstManagerRequest) =>
    toIpcResult<CreateFirstManagerResponse>(() => {
      const employee = authService.createFirstManager(
        request.name,
        request.username,
        request.password,
      );
      session.login(employee);
      return employee;
    }),
  );
}
