/**
 * Pure "merge one employee's own shifts, approved time off and approved
 * recurring unavailability into a per-day summary" logic, used by the
 * read-only `MySchedulePage`. Kept side-effect free (no DB, no Electron, no
 * React) so it can be unit-tested directly, mirroring
 * `unavailabilityConflict.ts`/`overlapDetection.ts`.
 *
 * Unlike the schedule board (one department, all employees), this view is
 * one employee across ALL departments they belong to — callers pass in
 * shifts already aggregated across every department (see
 * `useAllDepartmentsScheduleWeek`) and this function does the per-employee
 * filtering itself, so callers don't need to pre-filter anything by
 * `employeeId` or `status` before calling.
 */
import type {
  EmployeeUnavailability,
  ScheduledShift,
  TimeOffRequest,
} from '../types/domain';
import type { ResolvedHours } from './hoursResolution';
import { getDayOfWeek } from './weekRange';

export interface MyScheduleDayInput {
  date: string;
  label: string;
  hours: ResolvedHours;
}

export interface MyScheduleDay {
  date: string;
  label: string;
  hours: ResolvedHours;
  /** This employee's shift(s) on this date, across whichever department(s), sorted earliest-first. */
  shifts: ScheduledShift[];
  /** True when an APPROVED time-off request covers this date. */
  isApprovedTimeOff: boolean;
  /** This employee's APPROVED recurring unavailability entries whose day-of-week matches this date. */
  unavailability: EmployeeUnavailability[];
}

function compareShiftStart(a: ScheduledShift, b: ScheduledShift): number {
  return (a.startTime ?? '').localeCompare(b.startTime ?? '');
}

/**
 * Builds one `MyScheduleDay` per entry in `days` for `employeeId`.
 *  - `shifts`/`timeOffRequests`/`unavailability` may contain other
 *    employees' rows or non-approved requests — this function scopes them
 *    down to `employeeId` (and, for time off/unavailability, `status ===
 *    'approved'`) itself.
 *  - A day with no shift is still returned (with an empty `shifts` array)
 *    rather than omitted, so the caller can render a clear "Off" state
 *    instead of just leaving a gap.
 */
export function buildMyScheduleDays(
  days: MyScheduleDayInput[],
  employeeId: number,
  shifts: ScheduledShift[],
  timeOffRequests: TimeOffRequest[],
  unavailability: EmployeeUnavailability[],
): MyScheduleDay[] {
  const ownShifts = shifts.filter((shift) => shift.employeeId === employeeId);
  const ownApprovedTimeOff = timeOffRequests.filter(
    (request) => request.employeeId === employeeId && request.status === 'approved',
  );
  const ownApprovedUnavailability = unavailability.filter(
    (entry) => entry.employeeId === employeeId && entry.status === 'approved',
  );

  return days.map((day) => ({
    date: day.date,
    label: day.label,
    hours: day.hours,
    shifts: ownShifts
      .filter((shift) => shift.shiftDate === day.date)
      .sort(compareShiftStart),
    isApprovedTimeOff: ownApprovedTimeOff.some(
      (request) => day.date >= request.startDate && day.date <= request.endDate,
    ),
    unavailability: ownApprovedUnavailability.filter(
      (entry) => entry.dayOfWeek === getDayOfWeek(day.date),
    ),
  }));
}
