import type { EndAnchor, StartAnchor } from '@shared/types/domain';

export type TimeFormat = '24h' | '12h';

/** Converts an `HH:mm` (24-hour) string to a 12-hour clock label (e.g. "14:00" -> "2:00 PM"); `'24h'` returns `time` unchanged. */
export function formatClockTime(time: string, format: TimeFormat): string {
  if (format === '24h') {
    return time;
  }
  const [hoursStr, minutes] = time.split(':');
  const hours = Number(hoursStr);
  const period = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${minutes} ${period}`;
}

/** The literal-time-or-anchor-label text for one edge of a shift/template (e.g. "2:00 PM" or "Close"). */
export function formatStartEdge(
  anchor: StartAnchor,
  time: string | null,
  format: TimeFormat,
): string {
  if (anchor !== 'fixed') {
    return 'Open';
  }
  return time !== null ? formatClockTime(time, format) : '—';
}

export function formatEndEdge(anchor: EndAnchor, time: string | null, format: TimeFormat): string {
  if (anchor !== 'fixed') {
    return 'Close';
  }
  return time !== null ? formatClockTime(time, format) : '—';
}
