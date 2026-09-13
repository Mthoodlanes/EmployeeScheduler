/**
 * Pure "does this shift fall inside an employee's approved hard
 * unavailability" logic, used by the schedule grid's assign-shift dialog.
 * Unlike `time_off_requests` (a one-off blocked date range) unavailability
 * is a RECURRING day-of-week + time-window constraint, so the comparison is
 * always against a shift's day-of-week + `[start, end)` time range rather
 * than a calendar date. Kept side-effect free so it can be unit-tested
 * directly, mirroring `overlapDetection.ts`/`preferenceMatch.ts`.
 *
 * Callers are expected to pass in a list already scoped to one employee's
 * APPROVED entries (e.g. via `EmployeeUnavailability[]` filtered by
 * `employeeId` from a query that already filters `status === 'approved'`
 * server-side) — same convention `ScheduleBoardPage` already uses for
 * approved time off.
 */
import type { EmployeeUnavailability } from '../types/domain';
import { timeRangesOverlap } from './shiftMath';

/**
 * A full day off is represented as the `00:00`-`23:59` window (see
 * `EmployeeUnavailability` doc comment) rather than a dedicated sentinel —
 * this only needs to check the convention for display purposes ("Unavailable
 * all day" vs. a specific window), never for the overlap math itself, which
 * treats it like any other (very wide) window.
 */
export function isFullDayUnavailability(entry: Pick<EmployeeUnavailability, 'startTime' | 'endTime'>): boolean {
  return entry.startTime === '00:00' && entry.endTime === '23:59';
}

/**
 * All of `employeeUnavailability` (already scoped to one employee) that fall
 * on `dayOfWeek`, regardless of whether any particular shift's time overlaps
 * them — used to render the informational "here's what this employee has
 * said" panel in the assign-shift dialog ahead of any actual conflict.
 */
export function findUnavailabilityForDay(
  dayOfWeek: number,
  employeeUnavailability: EmployeeUnavailability[],
): EmployeeUnavailability[] {
  return employeeUnavailability.filter((entry) => entry.dayOfWeek === dayOfWeek);
}

/**
 * The subset of `employeeUnavailability` (already scoped to one employee)
 * that fall on `dayOfWeek` AND whose time window actually overlaps
 * `[shiftStart, shiftEnd)` — used to decide whether to show the warn/confirm
 * interstitial before actually assigning a shift.
 */
export function findUnavailabilityConflicts(
  dayOfWeek: number,
  shiftStart: string,
  shiftEnd: string,
  employeeUnavailability: EmployeeUnavailability[],
): EmployeeUnavailability[] {
  return findUnavailabilityForDay(dayOfWeek, employeeUnavailability).filter((entry) =>
    timeRangesOverlap(shiftStart, shiftEnd, entry.startTime, entry.endTime),
  );
}
