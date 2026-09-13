import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/types/ipc';
import type {
  IpcResult,
  WindowControlsCloseResponse,
  WindowControlsIsMaximizedResponse,
  WindowControlsMaximizedChangedPayload,
  WindowControlsMinimizeResponse,
  WindowControlsToggleMaximizeResponse,
} from '../shared/types/ipc';

async function invoke<T>(channel: string, request?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, request)) as IpcResult<T>;
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Milestone 23: the Electron app is now a thin shell whose `BrowserWindow`
 * just loads the hosted site (`loadURL(APP_URL)` in `src/main/index.ts`)
 * instead of running its own local SQLite-backed backend. Every data
 * namespace this bridge used to expose (`auth`, `employees`,
 * `shiftTemplates`, `scheduledShifts`, `timeOff`, `unavailability`,
 * `preferences`, `storeHours`, `specialEvents`) now flows through the SAME
 * `fetch`-based `httpApi` the plain web/PWA build already uses
 * (`src/renderer/src/api/httpClient.ts`, Milestone 19), hitting the real
 * `/api/*` routes same-origin. `windowControls` has no web equivalent —
 * native window chrome can't be driven from a page's own `fetch` calls — so
 * it's the only namespace left here.
 */
const api = {
  windowControls: {
    minimize: () => invoke<WindowControlsMinimizeResponse>(IpcChannels.windowControlsMinimize),
    toggleMaximize: () =>
      invoke<WindowControlsToggleMaximizeResponse>(IpcChannels.windowControlsToggleMaximize),
    close: () => invoke<WindowControlsCloseResponse>(IpcChannels.windowControlsClose),
    isMaximized: () =>
      invoke<WindowControlsIsMaximizedResponse>(IpcChannels.windowControlsIsMaximized),
    /**
     * Subscribes to the main process's push of maximize/unmaximize state (fired
     * for both IPC-driven toggles and native ones, e.g. double-clicking the
     * drag region). Returns an unsubscribe function, mirroring the cleanup
     * pattern React effects expect.
     */
    onMaximizedChange: (callback: (isMaximized: WindowControlsMaximizedChangedPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean): void =>
        callback(isMaximized);
      ipcRenderer.on(IpcChannels.windowControlsMaximizedChanged, listener);
      return () => {
        ipcRenderer.removeListener(IpcChannels.windowControlsMaximizedChanged, listener);
      };
    },
  },
};

export type Api = typeof api;

contextBridge.exposeInMainWorld('api', api);
