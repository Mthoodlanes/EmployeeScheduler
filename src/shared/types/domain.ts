/**
 * Domain model shared between main, preload and renderer processes.
 * These map closely to the SQLite schema defined in
 * src/main/db/migrations/001_init.ts.
 */

export type Department = 'front_desk' | 'cafe' | 'bar' | 'mechanic';

export const DEPARTMENTS: Department[] = ['front_desk', 'cafe', 'bar', 'mechanic'];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  front_desk: 'Front Desk',
  cafe: 'Cafe',
  bar: 'Bar',
  mechanic: 'Mechanic',
};

export type Role = 'manager' | 'employee';

export interface Employee {
  id: number;
  name: string;
  username: string;
  role: Role;
  isSalaried: boolean;
  isActive: boolean;
  /**
   * Global position on the Schedule Board (ascending), independent of
   * department — an employee working multiple departments has one
   * consistent position everywhere. Drives `employeeRepo.listAll()`'s
   * default order; `EmployeesAdminPage` sorts by name client-side instead
   * (see that page) since it's about looking someone up, not matching the
   * physical schedule board.
   */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Employee record including the password hash, used only inside the main process. */
export interface EmployeeWithHash extends Employee {
  passwordHash: string;
}

export interface EmployeeDepartment {
  id: number;
  employeeId: number;
  department: Department;
}

/**
 * A shift's start can only be a fixed clock time or anchored to the store's
 * resolved opening time for that date; its end can only be fixed or anchored
 * to closing time. `ShiftTimeAnchor` is the union of both, used by
 * `hoursResolution.ts#resolveShiftTime` which resolves either edge.
 */
export type StartAnchor = 'fixed' | 'open';
export type EndAnchor = 'fixed' | 'close';
export type ShiftTimeAnchor = StartAnchor | EndAnchor;

export interface ShiftTemplate {
  id: number;
  /** NULL means the template is shared — usable from any of the three department tabs. */
  department: Department | null;
  name: string;
  /** HH:mm, 24h. Null when `startAnchor` isn't `'fixed'` — the time is resolved live instead. */
  startTime: string | null;
  /** HH:mm, 24h. Null when `endAnchor` isn't `'fixed'`. */
  endTime: string | null;
  startAnchor: StartAnchor;
  endAnchor: EndAnchor;
  color: string; // hex color used on the schedule grid
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledShift {
  id: number;
  employeeId: number;
  department: Department;
  shiftDate: string; // YYYY-MM-DD
  /** HH:mm. Null when `startAnchor` isn't `'fixed'` — resolved live from that date's hours instead. */
  startTime: string | null;
  /** HH:mm. Null when `endAnchor` isn't `'fixed'`. */
  endTime: string | null;
  startAnchor: StartAnchor;
  endAnchor: EndAnchor;
  templateId: number | null;
  isOverride: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shared by every manager-approved employee request in the app (time off,
 * unavailability) — see `approvalStateMachine.ts` for the transition rules.
 */
export type ApprovalStatus = 'pending' | 'approved' | 'denied';

export type TimeOffStatus = ApprovalStatus;

export interface TimeOffRequest {
  id: number;
  employeeId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string | null;
  status: TimeOffStatus;
  decidedBy: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UnavailabilityStatus = ApprovalStatus;

/**
 * A RECURRING day-of-week + time-window HARD constraint ("can't work
 * Sundays", "can't work weekdays after 6pm") — distinct from
 * `TimeOffRequest` (a one-off blocked date range) and `EmployeePreference`
 * (a soft, non-blocking hint). Goes through the same
 * pending/approved/denied workflow as time off: an employee's own
 * self-submitted entry starts `pending`; a manager submitting on an
 * employee's behalf is auto-approved. A full day off is represented as the
 * `00:00`-`23:59` window rather than a dedicated sentinel, consistent with
 * how every other time field in the app (`employee_preferences`,
 * `store_hours`) is a plain `HH:mm` string with no special "all day" value.
 */
export interface EmployeeUnavailability {
  id: number;
  employeeId: number;
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  startTime: string; // HH:mm
  endTime: string; // HH:mm — see doc comment above re: the 00:00-23:59 "all day" convention
  reason: string | null;
  status: UnavailabilityStatus;
  /** The employee id who submitted the request — usually `employeeId`, but may be a manager submitting on the employee's behalf. */
  requestedBy: number;
  decidedBy: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeePreference {
  id: number;
  employeeId: number;
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  preferredStartTime: string | null; // HH:mm
  preferredEndTime: string | null; // HH:mm
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full weekday names indexed by the app's 0 (Sunday) - 6 (Saturday) convention. */
export const DAY_OF_WEEK_LABELS: string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export interface StoreHours {
  id: number;
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  openTime: string | null; // HH:mm, null when closed
  closeTime: string | null; // HH:mm, null when closed
  isClosed: boolean;
}

export interface SpecialEventOverride {
  id: number;
  eventDate: string; // YYYY-MM-DD
  label: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  createdAt: string;
  updatedAt: string;
}
