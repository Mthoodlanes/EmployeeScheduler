/**
 * Pure cross-cutting overlap detection for the weekly schedule grid. Takes
 * every scheduled shift for a week across ALL departments (not just one) plus
 * the employee roster, and returns every pair of shifts that conflict — the
 * same employee assigned to two shifts, on the same date, whose time ranges
 * actually intersect. Detects both cross-department conflicts (the primary
 * real-world case — e.g. Cafe 9-2 and Bar 1-6 the same day) and
 * same-department double-bookings.
 *
 * Kept side-effect free (no DB, no Electron, no React) so it can be
 * unit-tested directly and reused by both the renderer (live banner) and any
 * future main-process validation.
 *
 * Shifts are resolved to their actual clock time for their specific
 * `shiftDate` before comparison (via `hoursResolution#resolveShiftTime`) —
 * an anchored "2pm-Close" shift's interval uses THAT date's resolved close
 * time, which automatically reflects a special-event override extending (or
 * shortening) hours that day. A shift that cannot be resolved (its anchor is
 * 'open'/'close' but the store is marked fully closed that date) is excluded
 * from comparison entirely — there's no meaningful interval to compare.
 * Interval comparison itself (`shiftMath#timeRangesOverlap`) also honors the
 * app's midnight-crossing convention, so an overnight shift is compared
 * correctly rather than via naive string comparison.
 */
import type { Department, ScheduledShift, SpecialEventOverride, StoreHours } from '../types/domain';
import { resolveShiftTime } from './hoursResolution';
import { timeRangesOverlap } from './shiftMath';

export interface OverlapShiftInfo {
  department: Department;
  shiftId: number;
  start: string;
  end: string;
}

export interface OverlapWarning {
  employeeId: number;
  employeeName: string;
  date: string;
  shiftA: OverlapShiftInfo;
  shiftB: OverlapShiftInfo;
}

/** The minimal employee shape this module needs — a structural subset of `Employee`. */
export interface OverlapEmployee {
  id: number;
  name: string;
  isSalaried: boolean;
}

interface ResolvedShift {
  shift: ScheduledShift;
  start: string;
  end: string;
}

/** Resolves a shift's actual `[start, end)` for its own date, or `null` if either edge can't be resolved. */
function resolveShiftRange(
  shift: ScheduledShift,
  storeHours: StoreHours[],
  overrides: SpecialEventOverride[],
): { start: string; end: string } | null {
  const start = resolveShiftTime(
    shift.startAnchor,
    shift.startTime,
    shift.shiftDate,
    storeHours,
    overrides,
  );
  const end = resolveShiftTime(
    shift.endAnchor,
    shift.endTime,
    shift.shiftDate,
    storeHours,
    overrides,
  );
  if (start === null || end === null) {
    return null;
  }
  return { start, end };
}

/**
 * Detects every pairwise overlap among `shifts` (expected to span the full
 * week across all departments). Salaried employees are excluded entirely —
 * they never produce or appear in a warning, even when their shifts clearly
 * overlap, since their hours are intentionally flexible. `storeHours`/
 * `overrides` are only needed when at least one shift is anchored
 * ('open'/'close'); shifts with a `'fixed'` anchor on both edges compare
 * correctly even when they're omitted (both default to `[]`).
 */
export function detectOverlaps(
  shifts: ScheduledShift[],
  employees: OverlapEmployee[],
  storeHours: StoreHours[] = [],
  overrides: SpecialEventOverride[] = [],
): OverlapWarning[] {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));

  const shiftsByEmployeeAndDate = new Map<string, ResolvedShift[]>();
  shifts.forEach((shift) => {
    const employee = employeesById.get(shift.employeeId);
    if (!employee || employee.isSalaried) {
      return;
    }
    const range = resolveShiftRange(shift, storeHours, overrides);
    if (!range) {
      return;
    }
    const key = `${shift.employeeId}|${shift.shiftDate}`;
    const resolved: ResolvedShift = { shift, start: range.start, end: range.end };
    const existing = shiftsByEmployeeAndDate.get(key);
    if (existing) {
      existing.push(resolved);
    } else {
      shiftsByEmployeeAndDate.set(key, [resolved]);
    }
  });

  const warnings: OverlapWarning[] = [];
  shiftsByEmployeeAndDate.forEach((dayShifts) => {
    if (dayShifts.length < 2) {
      return;
    }
    const employee = employeesById.get(dayShifts[0].shift.employeeId) as OverlapEmployee;

    for (let i = 0; i < dayShifts.length; i += 1) {
      for (let j = i + 1; j < dayShifts.length; j += 1) {
        const a = dayShifts[i];
        const b = dayShifts[j];
        if (timeRangesOverlap(a.start, a.end, b.start, b.end)) {
          warnings.push({
            employeeId: employee.id,
            employeeName: employee.name,
            date: a.shift.shiftDate,
            shiftA: {
              department: a.shift.department,
              shiftId: a.shift.id,
              start: a.start,
              end: a.end,
            },
            shiftB: {
              department: b.shift.department,
              shiftId: b.shift.id,
              start: b.start,
              end: b.end,
            },
          });
        }
      }
    }
  });

  return warnings;
}
