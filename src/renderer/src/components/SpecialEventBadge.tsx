import type { ResolvedHours } from '@shared/logic/hoursResolution';
import { formatClockTime } from '../utils/formatShiftTime';
import type { TimeFormat } from '../utils/formatShiftTime';
import { useTimeFormat } from '../settings/TimeFormatProvider';

interface SpecialEventBadgeProps {
  hours: ResolvedHours;
  /**
   * Prefixes the plain-hours and closed/unknown cases with "Store Hours: "
   * — off by default so the Schedule Board's day-column headers (tight on
   * space, one per day across the whole grid) stay exactly as they were.
   * `MySchedulePage` turns this on, since it has room for the clearer
   * label and isn't showing seven of these side by side. Left off the
   * special-event-override case regardless, since that already carries its
   * own label (e.g. "League Night: 8:00 AM–10:00 PM") and stacking a
   * second one in front reads as redundant.
   */
  showLabel?: boolean;
}

function formatRange(openTime: string | null, closeTime: string | null, format: TimeFormat): string {
  return openTime && closeTime
    ? `${formatClockTime(openTime, format)}–${formatClockTime(closeTime, format)}`
    : '';
}

/**
 * Shown under a schedule-grid day column's date header — the day's
 * effective hours per `resolveHoursForDate`. A special-event override gets a
 * distinct ribbon treatment carrying its label; a fully closed day (whether
 * from an override or the weekly default) gets an even more distinct
 * "Closed" treatment; a normal day just shows its open-close range.
 */
export function SpecialEventBadge({
  hours,
  showLabel = false,
}: SpecialEventBadgeProps): React.JSX.Element {
  const { timeFormat } = useTimeFormat();
  const prefix = showLabel ? 'Store Hours: ' : '';

  if (hours.isClosed) {
    return (
      <span className="hours-badge hours-badge-closed" data-testid="hours-badge-closed">
        {prefix}
        {hours.label ? `Closed — ${hours.label}` : 'Closed'}
      </span>
    );
  }

  if (hours.isOverride) {
    return (
      <span className="hours-badge hours-badge-event" data-testid="hours-badge-event">
        {hours.label}: {formatRange(hours.openTime, hours.closeTime, timeFormat)}
      </span>
    );
  }

  if (!hours.openTime || !hours.closeTime) {
    return (
      <span className="hours-badge hours-badge-unknown" data-testid="hours-badge-unknown">
        {prefix}Hours not set
      </span>
    );
  }

  return (
    <span className="hours-badge" data-testid="hours-badge-default">
      {prefix}
      {formatRange(hours.openTime, hours.closeTime, timeFormat)}
    </span>
  );
}
