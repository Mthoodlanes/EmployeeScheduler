import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/types/ipc';
import type {
  CreateFirstManagerRequest,
  CreateFirstManagerResponse,
  EmployeesCreateRequest,
  EmployeesCreateResponse,
  EmployeesDeactivateRequest,
  EmployeesDeactivateResponse,
  EmployeesListResponse,
  EmployeesSetDepartmentsRequest,
  EmployeesSetDepartmentsResponse,
  EmployeesUpdateOwnProfileRequest,
  EmployeesUpdateOwnProfileResponse,
  EmployeesUpdateRequest,
  EmployeesUpdateResponse,
  FirstRunStatusResponse,
  GetSessionResponse,
  IpcResult,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  PreferencesCreateRequest,
  PreferencesCreateResponse,
  PreferencesListAllResponse,
  PreferencesListForEmployeeRequest,
  PreferencesListForEmployeeResponse,
  PreferencesRemoveRequest,
  PreferencesRemoveResponse,
  PreferencesUpdateRequest,
  PreferencesUpdateResponse,
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
  ShiftTemplatesCreateRequest,
  ShiftTemplatesCreateResponse,
  ShiftTemplatesDeactivateRequest,
  ShiftTemplatesDeactivateResponse,
  ShiftTemplatesListResponse,
  ShiftTemplatesUpdateRequest,
  ShiftTemplatesUpdateResponse,
  SpecialEventsCreateRequest,
  SpecialEventsCreateResponse,
  SpecialEventsListResponse,
  SpecialEventsRemoveRequest,
  SpecialEventsRemoveResponse,
  SpecialEventsUpdateRequest,
  SpecialEventsUpdateResponse,
  StoreHoursListResponse,
  StoreHoursUpsertRequest,
  StoreHoursUpsertResponse,
  TimeOffCreateForEmployeeRequest,
  TimeOffCreateForEmployeeResponse,
  TimeOffCreateRequestRequest,
  TimeOffCreateRequestResponse,
  TimeOffDecideRequest,
  TimeOffDecideResponse,
  TimeOffListAllResponse,
  TimeOffListApprovedForRangeRequest,
  TimeOffListApprovedForRangeResponse,
  TimeOffListOwnResponse,
  UnavailabilityCreateForEmployeeRequest,
  UnavailabilityCreateForEmployeeResponse,
  UnavailabilityCreateOwnRequestRequest,
  UnavailabilityCreateOwnRequestResponse,
  UnavailabilityDecideRequest,
  UnavailabilityDecideResponse,
  UnavailabilityListAllResponse,
  UnavailabilityListApprovedAllResponse,
  UnavailabilityListOwnResponse,
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

const api = {
  auth: {
    login: (request: LoginRequest) => invoke<LoginResponse>(IpcChannels.authLogin, request),
    logout: () => invoke<LogoutResponse>(IpcChannels.authLogout),
    getSession: () => invoke<GetSessionResponse>(IpcChannels.authGetSession),
    firstRunStatus: () => invoke<FirstRunStatusResponse>(IpcChannels.authFirstRunStatus),
    createFirstManager: (request: CreateFirstManagerRequest) =>
      invoke<CreateFirstManagerResponse>(IpcChannels.authCreateFirstManager, request),
  },
  employees: {
    list: () => invoke<EmployeesListResponse>(IpcChannels.employeesList),
    create: (request: EmployeesCreateRequest) =>
      invoke<EmployeesCreateResponse>(IpcChannels.employeesCreate, request),
    update: (request: EmployeesUpdateRequest) =>
      invoke<EmployeesUpdateResponse>(IpcChannels.employeesUpdate, request),
    deactivate: (request: EmployeesDeactivateRequest) =>
      invoke<EmployeesDeactivateResponse>(IpcChannels.employeesDeactivate, request),
    setDepartments: (request: EmployeesSetDepartmentsRequest) =>
      invoke<EmployeesSetDepartmentsResponse>(IpcChannels.employeesSetDepartments, request),
    updateOwnProfile: (request: EmployeesUpdateOwnProfileRequest) =>
      invoke<EmployeesUpdateOwnProfileResponse>(IpcChannels.employeesUpdateOwnProfile, request),
  },
  shiftTemplates: {
    list: () => invoke<ShiftTemplatesListResponse>(IpcChannels.shiftTemplatesList),
    create: (request: ShiftTemplatesCreateRequest) =>
      invoke<ShiftTemplatesCreateResponse>(IpcChannels.shiftTemplatesCreate, request),
    update: (request: ShiftTemplatesUpdateRequest) =>
      invoke<ShiftTemplatesUpdateResponse>(IpcChannels.shiftTemplatesUpdate, request),
    deactivate: (request: ShiftTemplatesDeactivateRequest) =>
      invoke<ShiftTemplatesDeactivateResponse>(IpcChannels.shiftTemplatesDeactivate, request),
  },
  scheduledShifts: {
    listWeek: (request: ScheduledShiftsListWeekRequest) =>
      invoke<ScheduledShiftsListWeekResponse>(IpcChannels.scheduledShiftsListWeek, request),
    assignTemplate: (request: ScheduledShiftsAssignTemplateRequest) =>
      invoke<ScheduledShiftsAssignTemplateResponse>(
        IpcChannels.scheduledShiftsAssignTemplate,
        request,
      ),
    assignCustom: (request: ScheduledShiftsAssignCustomRequest) =>
      invoke<ScheduledShiftsAssignCustomResponse>(IpcChannels.scheduledShiftsAssignCustom, request),
    override: (request: ScheduledShiftsOverrideRequest) =>
      invoke<ScheduledShiftsOverrideResponse>(IpcChannels.scheduledShiftsOverride, request),
    remove: (request: ScheduledShiftsRemoveRequest) =>
      invoke<ScheduledShiftsRemoveResponse>(IpcChannels.scheduledShiftsRemove, request),
  },
  timeOff: {
    createRequest: (request: TimeOffCreateRequestRequest) =>
      invoke<TimeOffCreateRequestResponse>(IpcChannels.timeOffCreateRequest, request),
    createForEmployee: (request: TimeOffCreateForEmployeeRequest) =>
      invoke<TimeOffCreateForEmployeeResponse>(IpcChannels.timeOffCreateForEmployee, request),
    listOwn: () => invoke<TimeOffListOwnResponse>(IpcChannels.timeOffListOwn),
    listAll: () => invoke<TimeOffListAllResponse>(IpcChannels.timeOffListAll),
    decide: (request: TimeOffDecideRequest) =>
      invoke<TimeOffDecideResponse>(IpcChannels.timeOffDecide, request),
    listApprovedForRange: (request: TimeOffListApprovedForRangeRequest) =>
      invoke<TimeOffListApprovedForRangeResponse>(IpcChannels.timeOffListApprovedForRange, request),
  },
  unavailability: {
    createOwnRequest: (request: UnavailabilityCreateOwnRequestRequest) =>
      invoke<UnavailabilityCreateOwnRequestResponse>(
        IpcChannels.unavailabilityCreateOwnRequest,
        request,
      ),
    createForEmployee: (request: UnavailabilityCreateForEmployeeRequest) =>
      invoke<UnavailabilityCreateForEmployeeResponse>(
        IpcChannels.unavailabilityCreateForEmployee,
        request,
      ),
    listOwn: () => invoke<UnavailabilityListOwnResponse>(IpcChannels.unavailabilityListOwn),
    listAll: () => invoke<UnavailabilityListAllResponse>(IpcChannels.unavailabilityListAll),
    listApprovedAll: () =>
      invoke<UnavailabilityListApprovedAllResponse>(IpcChannels.unavailabilityListApprovedAll),
    decide: (request: UnavailabilityDecideRequest) =>
      invoke<UnavailabilityDecideResponse>(IpcChannels.unavailabilityDecide, request),
  },
  preferences: {
    listAll: () => invoke<PreferencesListAllResponse>(IpcChannels.preferencesListAll),
    listForEmployee: (request: PreferencesListForEmployeeRequest) =>
      invoke<PreferencesListForEmployeeResponse>(IpcChannels.preferencesListForEmployee, request),
    create: (request: PreferencesCreateRequest) =>
      invoke<PreferencesCreateResponse>(IpcChannels.preferencesCreate, request),
    update: (request: PreferencesUpdateRequest) =>
      invoke<PreferencesUpdateResponse>(IpcChannels.preferencesUpdate, request),
    remove: (request: PreferencesRemoveRequest) =>
      invoke<PreferencesRemoveResponse>(IpcChannels.preferencesRemove, request),
  },
  storeHours: {
    list: () => invoke<StoreHoursListResponse>(IpcChannels.storeHoursList),
    upsert: (request: StoreHoursUpsertRequest) =>
      invoke<StoreHoursUpsertResponse>(IpcChannels.storeHoursUpsert, request),
  },
  specialEvents: {
    list: () => invoke<SpecialEventsListResponse>(IpcChannels.specialEventsList),
    create: (request: SpecialEventsCreateRequest) =>
      invoke<SpecialEventsCreateResponse>(IpcChannels.specialEventsCreate, request),
    update: (request: SpecialEventsUpdateRequest) =>
      invoke<SpecialEventsUpdateResponse>(IpcChannels.specialEventsUpdate, request),
    remove: (request: SpecialEventsRemoveRequest) =>
      invoke<SpecialEventsRemoveResponse>(IpcChannels.specialEventsRemove, request),
  },
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
