/**
 * Milestone 16: line-for-line port of `src/shared/logic/weekRange.ts`.
 * `server/` cannot import from `src/shared` (established constraint from
 * Milestone 15 — see `server/src/db/domain-types.ts`'s header comment), so
 * the specific pure functions actually needed by the ported services are
 * duplicated here instead. Only `getWeekDates` is currently called (by
 * `scheduledShiftService.listWeek`), but the rest of the module is ported
 * verbatim too since it is a single small, well-tested, side-effect-free
 * file — splitting one function out of it would diverge from the original
 * rather than mirror it.
 *
 * Pure date-range logic for the weekly schedule grid. All dates are plain
 * `YYYY-MM-DD` strings (no time-of-day, no local timezone) and every
 * computation happens on UTC-normalized `Date` objects so the result never
 * shifts depending on the host machine's timezone or DST rules. Weeks run
 * Monday through Sunday.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns the `YYYY-MM-DD` of the Monday belonging to the same week as `iso`. */
export function getWeekStart(iso: string): string {
  const date = parseIsoDate(iso);
  const dayOfWeek = date.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const diffToMonday = (dayOfWeek + 6) % 7; // Mon -> 0, Sun -> 6
  return toIsoDate(new Date(date.getTime() - diffToMonday * DAY_MS));
}

/** Returns the 7 `YYYY-MM-DD` dates of the week starting at `weekStartIso` (Monday first). */
export function getWeekDates(weekStartIso: string): string[] {
  const start = parseIsoDate(weekStartIso);
  return Array.from({ length: 7 }, (_, index) =>
    toIsoDate(new Date(start.getTime() + index * DAY_MS)),
  );
}

/** Returns the `YYYY-MM-DD` Monday `deltaWeeks` weeks away from `weekStartIso` (may be negative). */
export function shiftWeek(weekStartIso: string, deltaWeeks: number): string {
  const start = parseIsoDate(weekStartIso);
  return toIsoDate(new Date(start.getTime() + deltaWeeks * 7 * DAY_MS));
}

/** Returns the day-of-week for `iso` as 0 (Sunday) - 6 (Saturday), matching `EmployeePreference.dayOfWeek`. */
export function getDayOfWeek(iso: string): number {
  return parseIsoDate(iso).getUTCDay();
}

/** Formats a single date as e.g. "Tue Sep 8". */
export function formatDayLabel(iso: string): string {
  const date = parseIsoDate(iso);
  return `${WEEKDAY_LABELS[date.getUTCDay()]} ${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Formats a week as e.g. "Week of Mon Sep 7 - Sun Sep 13". */
export function formatWeekLabel(weekStartIso: string): string {
  const dates = getWeekDates(weekStartIso);
  return `Week of ${formatDayLabel(dates[0])} - ${formatDayLabel(dates[dates.length - 1])}`;
}

/** Returns today's date as a local `YYYY-MM-DD` string (used to pick the initial grid week). */
export function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
