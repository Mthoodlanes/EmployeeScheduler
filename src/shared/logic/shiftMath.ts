/**
 * Pure shift-time arithmetic shared by duration displays and
 * `overlapDetection.ts`'s interval comparison. Centralizes the app's
 * midnight-crossing convention in one place: whenever an end time is less
 * than or equal to its start time (e.g. a "18:00-02:00" bar shift, or the
 * store's Wednesday "14:00-00:00" hours), the end is treated as falling on
 * the following calendar day rather than producing a negative or
 * nonsensical duration. Kept side-effect free so it can be unit-tested
 * directly, mirroring `hoursResolution.ts`/`overlapDetection.ts`.
 */

/** Parses an `HH:mm` string into minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Converts a `[start, end)` `HH:mm` range into minutes-since-midnight,
 * pushing `end` into the following day (adding 24h) whenever it is less
 * than or equal to `start`. Exported so any caller comparing two `HH:mm`
 * ranges (not just this module's own `timeRangesOverlap`) can honor the same
 * midnight-crossing convention rather than falling back to naive string
 * comparison, which silently breaks for an overnight range (see
 * `preferenceMatch.ts`, which does exactly this).
 */
export function toIntervalMinutes(start: string, end: string): [number, number] {
  const startMinutes = timeToMinutes(start);
  const endMinutesSameDay = timeToMinutes(end);
  const endMinutes =
    endMinutesSameDay <= startMinutes ? endMinutesSameDay + 24 * 60 : endMinutesSameDay;
  return [startMinutes, endMinutes];
}

/**
 * Duration in minutes between `startTime` and `endTime` (both `HH:mm`).
 * Crosses midnight (adds 24h to `endTime`) whenever `endTime` is less than
 * or equal to `startTime` — this includes the degenerate "24-hour" case
 * where they're equal, since a zero-length shift/hours row is never a
 * meaningful input in this app.
 */
export function shiftDurationMinutes(startTime: string, endTime: string): number {
  const [start, end] = toIntervalMinutes(startTime, endTime);
  return end - start;
}

/**
 * Whether two `[start, end)` `HH:mm` ranges intersect, honoring the
 * midnight-crossing convention above. Touching exactly at an endpoint (one
 * ends exactly when the other starts) is not an overlap.
 */
export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const [aStartMin, aEndMin] = toIntervalMinutes(aStart, aEnd);
  const [bStartMin, bEndMin] = toIntervalMinutes(bStart, bEnd);
  return aStartMin < bEndMin && bStartMin < aEndMin;
}
