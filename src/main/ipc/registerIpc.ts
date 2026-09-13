import { registerWindowControlsIpc } from './windowControls.ipc';

/**
 * Registers every ipcMain.handle() in the app. Call once from the main
 * entry point.
 *
 * Milestone 23: shrunk down to `windowControls` only — the Electron shell
 * now loads the hosted site directly, so every other namespace that used to
 * be registered here (`auth`, `employees`, `shiftTemplates`,
 * `scheduledShifts`, `timeOff`, `unavailability`, `preferences`,
 * `storeHours`, `specialEvents`) is gone; their functionality lives on in
 * `server/`'s Express routes instead, called over HTTP by the renderer's
 * `httpApi` (see `src/renderer/src/api/httpClient.ts`).
 */
export function registerIpc(): void {
  registerWindowControlsIpc();
}
