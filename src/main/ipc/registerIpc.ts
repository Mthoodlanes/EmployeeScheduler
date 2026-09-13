import { registerAuthIpc } from './auth.ipc';
import { registerEmployeesIpc } from './employees.ipc';
import { registerPreferencesIpc } from './preferences.ipc';
import { registerScheduledShiftsIpc } from './scheduledShifts.ipc';
import { registerShiftTemplatesIpc } from './shiftTemplates.ipc';
import { registerSpecialEventsIpc } from './specialEvents.ipc';
import { registerStoreHoursIpc } from './storeHours.ipc';
import { registerTimeOffIpc } from './timeOff.ipc';
import { registerUnavailabilityIpc } from './unavailability.ipc';
import { registerWindowControlsIpc } from './windowControls.ipc';

/** Registers every ipcMain.handle() in the app. Call once from the main entry point. */
export function registerIpc(): void {
  registerAuthIpc();
  registerEmployeesIpc();
  registerShiftTemplatesIpc();
  registerScheduledShiftsIpc();
  registerTimeOffIpc();
  registerUnavailabilityIpc();
  registerPreferencesIpc();
  registerStoreHoursIpc();
  registerSpecialEventsIpc();
  registerWindowControlsIpc();
}
