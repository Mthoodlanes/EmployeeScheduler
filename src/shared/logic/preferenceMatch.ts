/**
 * Pure "does this shift fall within a manager-entered preference window"
 * logic, used to softly (non-blockingly) decorate shift cards on the
 * schedule grid. Kept side-effect free so it can be unit-tested directly.
 *
 * Compares times via `shiftMath`'s minutes-since-midnight + midnight-crossing
 * convention (the same one `overlapDetection`/`hoursResolution` use) rather
 * than raw `HH:mm` string comparison — an overnight shift (e.g. `23:00`-
 * `01:00`) has an end time that sorts LOWER than its own start as a plain
 * string, which previously made naive `<=`/`>=` comparisons produce
 * nonsensical results (e.g. falsely "matching" a daytime-only preference
 * window purely because "01:00" < "17:00" lexically).
 */
import type { EmployeePreference } from '../types/domain';
import { timeRangesOverlap, toIntervalMinutes } from './shiftMath';

export type PreferenceMatchResult = 'matches' | 'partial' | 'outside' | 'none';

function hasWindow(
  preference: EmployeePreference,
): preference is EmployeePreference & { preferredStartTime: string; preferredEndTime: string } {
  return preference.preferredStartTime !== null && preference.preferredEndTime !== null;
}

/**
 * Compares a shift's `[shiftStart, shiftEnd)` time range against every
 * preference window an employee has stated for `dayOfWeek`:
 *  - `matches`  — the shift falls entirely within at least one window.
 *  - `partial`  — no window fully contains it, but at least one overlaps it.
 *  - `outside`  — the employee has window(s) for that day, none overlap.
 *  - `none`     — the employee has stated no preference for that day at all
 *                 (the neutral default — not a conflict signal).
 */
export function matchPreference(
  shiftStart: string,
  shiftEnd: string,
  dayOfWeek: number,
  preferences: EmployeePreference[],
): PreferenceMatchResult {
  const dayWindows = preferences
    .filter((preference) => preference.dayOfWeek === dayOfWeek)
    .filter(hasWindow);

  if (dayWindows.length === 0) {
    return 'none';
  }

  const [shiftStartMin, shiftEndMin] = toIntervalMinutes(shiftStart, shiftEnd);

  const fullyWithinAny = dayWindows.some((window) => {
    const [windowStartMin, windowEndMin] = toIntervalMinutes(
      window.preferredStartTime,
      window.preferredEndTime,
    );
    return shiftStartMin >= windowStartMin && shiftEndMin <= windowEndMin;
  });
  if (fullyWithinAny) {
    return 'matches';
  }

  const overlapsAny = dayWindows.some((window) =>
    timeRangesOverlap(shiftStart, shiftEnd, window.preferredStartTime, window.preferredEndTime),
  );
  if (overlapsAny) {
    return 'partial';
  }

  return 'outside';
}
