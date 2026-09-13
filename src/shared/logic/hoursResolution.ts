/**
 * Pure "what are the store's effective hours on this date" logic, used by the
 * schedule board's day-column headers. A `special_event_overrides` row for
 * the exact date wins entirely (including its own `isClosed`/hours/label),
 * regardless of what the weekly default says; otherwise the `store_hours`
 * row for that date's day-of-week applies. Kept side-effect free (no DB, no
 * Electron, no React) so it can be unit-tested directly, mirroring
 * `overlapDetection.ts`/`preferenceMatch.ts`.
 */
import type { ShiftTimeAnchor, SpecialEventOverride, StoreHours } from '../types/domain';
import { getDayOfWeek } from './weekRange';

export interface ResolvedHours {
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  label?: string;
  /** True when a special event override (not the weekly default) produced this result. */
  isOverride: boolean;
}

/**
 * Resolves the effective open/close hours for `date`:
 *  - An override for the exact date wins outright, closed or not.
 *  - Otherwise falls back to the weekly default for that date's day-of-week.
 *  - When neither exists (the weekly default hasn't been configured for that
 *    day yet), the day is treated as closed/unknown rather than throwing.
 */
export function resolveHoursForDate(
  date: string,
  storeHours: StoreHours[],
  overrides: SpecialEventOverride[],
): ResolvedHours {
  const override = overrides.find((candidate) => candidate.eventDate === date);
  if (override) {
    return {
      openTime: override.isClosed ? null : override.openTime,
      closeTime: override.isClosed ? null : override.closeTime,
      isClosed: override.isClosed,
      label: override.label,
      isOverride: true,
    };
  }

  const dayOfWeek = getDayOfWeek(date);
  const weeklyDefault = storeHours.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  if (!weeklyDefault) {
    // No weekly default configured for this day-of-week yet — treat as
    // closed/unknown rather than throwing; the UI flags this distinctly.
    return { openTime: null, closeTime: null, isClosed: true, isOverride: false };
  }

  return {
    openTime: weeklyDefault.isClosed ? null : weeklyDefault.openTime,
    closeTime: weeklyDefault.isClosed ? null : weeklyDefault.closeTime,
    isClosed: weeklyDefault.isClosed,
    isOverride: false,
  };
}

/**
 * Resolves a shift template/scheduled-shift's actual clock time for one edge
 * (start or end) given its anchor:
 *  - `'fixed'` returns the stored literal time as-is.
 *  - `'open'`/`'close'` resolves against `hours` (already computed for the
 *    shift's date via `resolveHoursForDate`) — the open or close time for
 *    that specific date, so a special-event override on that date is picked
 *    up automatically with no separate handling needed.
 *  - Returns `null` when the day resolves to fully closed — an anchored
 *    shift has nothing sensible to resolve to, so callers (the schedule
 *    grid, overlap detection) must treat `null` as "unresolved" rather than
 *    guessing a time.
 */
export function resolveShiftTimeFromHours(
  anchor: ShiftTimeAnchor,
  fixedTime: string | null,
  hours: ResolvedHours,
): string | null {
  if (anchor === 'fixed') {
    return fixedTime;
  }
  if (hours.isClosed) {
    return null;
  }
  return anchor === 'open' ? hours.openTime : hours.closeTime;
}

/**
 * Convenience wrapper around `resolveShiftTimeFromHours` for callers that
 * only have the raw `storeHours`/`overrides` data and a date, rather than an
 * already-resolved `ResolvedHours` (e.g. `overlapDetection`, main-process
 * services). UI code that already computed `ResolvedHours` for the day
 * column (the schedule grid) should call `resolveShiftTimeFromHours`
 * directly instead of re-deriving it per shift.
 */
export function resolveShiftTime(
  anchor: ShiftTimeAnchor,
  fixedTime: string | null,
  date: string,
  storeHours: StoreHours[],
  overrides: SpecialEventOverride[],
): string | null {
  if (anchor === 'fixed') {
    return fixedTime;
  }
  return resolveShiftTimeFromHours(
    anchor,
    fixedTime,
    resolveHoursForDate(date, storeHours, overrides),
  );
}
