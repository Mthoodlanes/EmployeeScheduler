import { BrowserWindow, ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type {
  WindowControlsCloseResponse,
  WindowControlsIsMaximizedResponse,
  WindowControlsMinimizeResponse,
  WindowControlsToggleMaximizeResponse,
} from '../../shared/types/ipc';
import { toIpcResult } from './ipcResult';

/**
 * Window chrome controls for the custom (frameless) title bar — see Milestone 9.
 * Unlike the rest of the IPC surface these aren't gated by `session`: they only
 * ever affect the window the renderer itself is running in, resolved per-call
 * from the invoking `event.sender` rather than a module-level window reference
 * (safer if the app ever opens more than one window).
 */
function windowFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

export function registerWindowControlsIpc(): void {
  ipcMain.handle(IpcChannels.windowControlsMinimize, (event) =>
    toIpcResult<WindowControlsMinimizeResponse>(() => {
      windowFromEvent(event)?.minimize();
      return { success: true };
    }),
  );

  ipcMain.handle(IpcChannels.windowControlsToggleMaximize, (event) =>
    toIpcResult<WindowControlsToggleMaximizeResponse>(() => {
      const window = windowFromEvent(event);
      if (!window) {
        return { isMaximized: false };
      }
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      return { isMaximized: window.isMaximized() };
    }),
  );

  ipcMain.handle(IpcChannels.windowControlsClose, (event) =>
    toIpcResult<WindowControlsCloseResponse>(() => {
      windowFromEvent(event)?.close();
      return { success: true };
    }),
  );

  ipcMain.handle(IpcChannels.windowControlsIsMaximized, (event) =>
    toIpcResult<WindowControlsIsMaximizedResponse>(() => windowFromEvent(event)?.isMaximized() ?? false),
  );
}
