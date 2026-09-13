/**
 * IPC channel names and request/response contracts shared between
 * main (handlers), preload (bridge) and renderer (callers).
 *
 * Milestone 23: the Electron shell now loads the hosted site directly
 * instead of running its own local backend, so `IpcChannels` below only
 * lists the `windowControls:*` channels — the one namespace with no web
 * equivalent (see `src/main/ipc/windowControls.ipc.ts`,
 * `src/preload/index.ts`). The request/response interfaces for every OTHER
 * namespace (`auth`, `employees`, `shiftTemplates`, `scheduledShifts`,
 * `timeOff`, `unavailability`, `preferences`, `storeHours`,
 * `specialEvents`) are still defined below and still very much alive —
 * they're no longer used as IPC contracts, but
 * `src/renderer/src/api/httpClient.ts` imports every one of them to type
 * its `fetch`-based implementations of the same HTTP routes
 * (`server/src/routes/*.routes.ts`), which preserve the same
 * request/response shapes on purpose (see the Phase 2 plan's "HTTP API
 * Surface" section).
 */
import type {
  Department,
  Employee,
  EmployeePreference,
  EmployeeUnavailability,
  EndAnchor,
  Role,
  ScheduledShift,
  ShiftTemplate,
  SpecialEventOverride,
  StartAnchor,
  StoreHours,
  TimeOffRequest,
} from './domain';

export const IpcChannels = {
  windowControlsMinimize: 'windowControls:minimize',
  windowControlsToggleMaximize: 'windowControls:toggleMaximize',
  windowControlsClose: 'windowControls:close',
  windowControlsIsMaximized: 'windowControls:isMaximized',
  /** Main → renderer push, not an `ipcMain.handle` channel — see preload's `onMaximizedChange`. */
  windowControlsMaximizedChanged: 'windowControls:maximizedChanged',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/** Generic envelope every IPC handler in this app resolves with. */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ---- auth:login ----
export interface LoginRequest {
  username: string;
  password: string;
}
export type LoginResponse = Employee;

// ---- auth:logout ----
export type LogoutRequest = undefined;
export type LogoutResponse = { success: true };

// ---- auth:getSession ----
export type GetSessionRequest = undefined;
export type GetSessionResponse = Employee | null;

// ---- auth:firstRunStatus ----
export type FirstRunStatusRequest = undefined;
export type FirstRunStatusResponse = { isFirstRun: boolean };

// ---- auth:createFirstManager ----
export interface CreateFirstManagerRequest {
  name: string;
  username: string;
  password: string;
}
export type CreateFirstManagerResponse = Employee;

// ---- employees:list ----
export type EmployeesListRequest = undefined;
export interface EmployeeWithDepartments extends Employee {
  departments: Department[];
}
export type EmployeesListResponse = EmployeeWithDepartments[];

// ---- employees:create ----
export interface EmployeesCreateRequest {
  name: string;
  username: string;
  password: string;
  role: Role;
  isSalaried: boolean;
  departments: Department[];
}
export type EmployeesCreateResponse = EmployeeWithDepartments;

// ---- employees:update ----
export interface EmployeesUpdateRequest {
  id: number;
  name: string;
  role: Role;
  isSalaried: boolean;
  isActive: boolean;
  /** Optional: only set when a manager wants to reset the password. */
  password?: string;
}
export type EmployeesUpdateResponse = EmployeeWithDepartments;

// ---- employees:deactivate ----
export interface EmployeesDeactivateRequest {
  id: number;
}
export type EmployeesDeactivateResponse = EmployeeWithDepartments;

// ---- employees:setDepartments ----
export interface EmployeesSetDepartmentsRequest {
  id: number;
  departments: Department[];
}
export type EmployeesSetDepartmentsResponse = EmployeeWithDepartments;

// ---- employees:updateOwnProfile ----
/**
 * Self-service counterpart to `employees:update`: operates on the CALLER's
 * own record (identity comes from the session/JWT, never from this
 * request), and can only ever change `name`/password — never
 * role/departments/isSalaried/isActive. `newPassword` requires
 * `currentPassword` to also be supplied and to verify correctly against the
 * stored hash.
 */
export interface EmployeesUpdateOwnProfileRequest {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}
export type EmployeesUpdateOwnProfileResponse = EmployeeWithDepartments;

// ---- employees:reorder ----
/**
 * Manager-only. `orderedIds` must be the COMPLETE set of every employee id,
 * in the desired new global order — not a partial/single-item move. The
 * renderer computes this by merging a department tab's drag-and-drop result
 * back into the full current order (see
 * `src/shared/logic/employeeOrder.ts#mergeReorderedSubset`).
 */
export interface EmployeesReorderRequest {
  orderedIds: number[];
}
export type EmployeesReorderResponse = EmployeeWithDepartments[];

// ---- shiftTemplates:list ----
export type ShiftTemplatesListRequest = undefined;
export type ShiftTemplatesListResponse = ShiftTemplate[];

// ---- shiftTemplates:create ----
export interface ShiftTemplatesCreateRequest {
  /** NULL creates a shared template usable from any of the three department tabs. */
  department: Department | null;
  name: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor: StartAnchor;
  endAnchor: EndAnchor;
  color?: string;
}
export type ShiftTemplatesCreateResponse = ShiftTemplate;

// ---- shiftTemplates:update ----
export interface ShiftTemplatesUpdateRequest {
  id: number;
  name: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor: StartAnchor;
  endAnchor: EndAnchor;
  color: string;
  isActive: boolean;
}
export type ShiftTemplatesUpdateResponse = ShiftTemplate;

// ---- shiftTemplates:deactivate ----
export interface ShiftTemplatesDeactivateRequest {
  id: number;
}
export type ShiftTemplatesDeactivateResponse = ShiftTemplate;

// ---- scheduledShifts:listWeek ----
export interface ScheduledShiftsListWeekRequest {
  department: Department;
  /** Monday of the target week, YYYY-MM-DD. */
  weekStart: string;
}
export type ScheduledShiftsListWeekResponse = ScheduledShift[];

// ---- scheduledShifts:assignTemplate ----
export interface ScheduledShiftsAssignTemplateRequest {
  employeeId: number;
  department: Department;
  shiftDate: string;
  templateId: number;
}
export type ScheduledShiftsAssignTemplateResponse = ScheduledShift;

// ---- scheduledShifts:assignCustom ----
export interface ScheduledShiftsAssignCustomRequest {
  employeeId: number;
  department: Department;
  shiftDate: string;
  startAnchor: StartAnchor;
  startTime: string | null;
  endAnchor: EndAnchor;
  endTime: string | null;
  notes?: string | null;
}
export type ScheduledShiftsAssignCustomResponse = ScheduledShift;

// ---- scheduledShifts:override ----
export interface ScheduledShiftsOverrideRequest {
  id: number;
  startTime: string;
  endTime: string;
  notes?: string | null;
}
export type ScheduledShiftsOverrideResponse = ScheduledShift;

// ---- scheduledShifts:remove ----
export interface ScheduledShiftsRemoveRequest {
  id: number;
}
export type ScheduledShiftsRemoveResponse = { success: true };

// ---- scheduledShifts:carryOverWeek ----
export interface ScheduledShiftsCarryOverWeekRequest {
  department: Department;
  /** Monday of the week to copy shifts FROM, YYYY-MM-DD. */
  sourceWeekStart: string;
  /** Monday of the week to copy shifts INTO, YYYY-MM-DD. */
  targetWeekStart: string;
  /** Omit to carry over every employee in `department`; otherwise just this one. */
  employeeId?: number;
}
export type ScheduledShiftsCarryOverWeekResponse = ScheduledShift[];

// ---- timeOff:createRequest ----
export interface TimeOffCreateRequestRequest {
  startDate: string;
  endDate: string;
  reason?: string | null;
}
export type TimeOffCreateRequestResponse = TimeOffRequest;

// ---- timeOff:listOwn ----
export type TimeOffListOwnRequest = undefined;
export type TimeOffListOwnResponse = TimeOffRequest[];

// ---- timeOff:listAll ----
export type TimeOffListAllRequest = undefined;
export type TimeOffListAllResponse = TimeOffRequest[];

// ---- timeOff:decide ----
export interface TimeOffDecideRequest {
  id: number;
  status: 'approved' | 'denied';
  decisionNote?: string | null;
}
export type TimeOffDecideResponse = TimeOffRequest;

// ---- timeOff:listApprovedForRange ----
export interface TimeOffListApprovedForRangeRequest {
  startDate: string;
  endDate: string;
}
export type TimeOffListApprovedForRangeResponse = TimeOffRequest[];

// ---- timeOff:createForEmployee ----
export interface TimeOffCreateForEmployeeRequest {
  employeeId: number;
  startDate: string;
  endDate: string;
  reason?: string | null;
}
export type TimeOffCreateForEmployeeResponse = TimeOffRequest;

// ---- unavailability:createOwnRequest ----
export interface UnavailabilityCreateOwnRequestRequest {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  reason?: string | null;
}
export type UnavailabilityCreateOwnRequestResponse = EmployeeUnavailability;

// ---- unavailability:createForEmployee ----
export interface UnavailabilityCreateForEmployeeRequest extends UnavailabilityCreateOwnRequestRequest {
  employeeId: number;
}
export type UnavailabilityCreateForEmployeeResponse = EmployeeUnavailability;

// ---- unavailability:listOwn ----
export type UnavailabilityListOwnRequest = undefined;
export type UnavailabilityListOwnResponse = EmployeeUnavailability[];

// ---- unavailability:listAll ----
export type UnavailabilityListAllRequest = undefined;
export type UnavailabilityListAllResponse = EmployeeUnavailability[];

// ---- unavailability:listApprovedAll ----
export type UnavailabilityListApprovedAllRequest = undefined;
export type UnavailabilityListApprovedAllResponse = EmployeeUnavailability[];

// ---- unavailability:decide ----
export interface UnavailabilityDecideRequest {
  id: number;
  status: 'approved' | 'denied';
  decisionNote?: string | null;
}
export type UnavailabilityDecideResponse = EmployeeUnavailability;

// ---- preferences:listAll ----
export type PreferencesListAllRequest = undefined;
export type PreferencesListAllResponse = EmployeePreference[];

// ---- preferences:listForEmployee ----
export interface PreferencesListForEmployeeRequest {
  employeeId: number;
}
export type PreferencesListForEmployeeResponse = EmployeePreference[];

// ---- preferences:create ----
export interface PreferencesCreateRequest {
  employeeId: number;
  dayOfWeek: number;
  preferredStartTime: string;
  preferredEndTime: string;
  note?: string | null;
}
export type PreferencesCreateResponse = EmployeePreference;

// ---- preferences:update ----
export interface PreferencesUpdateRequest {
  id: number;
  dayOfWeek: number;
  preferredStartTime: string;
  preferredEndTime: string;
  note?: string | null;
}
export type PreferencesUpdateResponse = EmployeePreference;

// ---- preferences:remove ----
export interface PreferencesRemoveRequest {
  id: number;
}
export type PreferencesRemoveResponse = { success: true };

// ---- storeHours:list ----
export type StoreHoursListRequest = undefined;
export type StoreHoursListResponse = StoreHours[];

// ---- storeHours:upsert ----
export interface StoreHoursUpsertRequest {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}
export type StoreHoursUpsertResponse = StoreHours;

// ---- specialEvents:list ----
export type SpecialEventsListRequest = undefined;
export type SpecialEventsListResponse = SpecialEventOverride[];

// ---- specialEvents:create ----
export interface SpecialEventsCreateRequest {
  eventDate: string;
  label: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}
export type SpecialEventsCreateResponse = SpecialEventOverride;

// ---- specialEvents:update ----
export interface SpecialEventsUpdateRequest {
  id: number;
  eventDate: string;
  label: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}
export type SpecialEventsUpdateResponse = SpecialEventOverride;

// ---- specialEvents:remove ----
export interface SpecialEventsRemoveRequest {
  id: number;
}
export type SpecialEventsRemoveResponse = { success: true };

// ---- windowControls:minimize / toggleMaximize / close ----
export type WindowControlsMinimizeResponse = { success: true };
export type WindowControlsToggleMaximizeResponse = { isMaximized: boolean };
export type WindowControlsCloseResponse = { success: true };

// ---- windowControls:isMaximized ----
export type WindowControlsIsMaximizedResponse = boolean;

// ---- windowControls:maximizedChanged (main -> renderer push) ----
export type WindowControlsMaximizedChangedPayload = boolean;
