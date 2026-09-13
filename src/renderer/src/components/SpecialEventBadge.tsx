import type { ResolvedHours } from '@shared/logic/hoursResolution';

interface SpecialEventBadgeProps {
  hours: ResolvedHours;
}

function formatRange(openTime: string | null, closeTime: string | null): string {
  return openTime && closeTime ? `${openTime}–${closeTime}` : '';
}

/**
 * Shown under a schedule-grid day column's date header — the day's
 * effective hours per `resolveHoursForDate`. A special-event override gets a
 * distinct ribbon treatment carrying its label; a fully closed day (whether
 * from an override or the weekly default) gets an even more distinct
 * "Closed" treatment; a normal day just shows its open-close range.
 */
export function SpecialEventBadge({ hours }: SpecialEventBadgeProps): React.JSX.Element {
  if (hours.isClosed) {
    return (
      <span className="hours-badge hours-badge-closed" data-testid="hours-badge-closed">
        {hours.label ? `Closed — ${hours.label}` : 'Closed'}
      </span>
    );
  }

  if (hours.isOverride) {
    return (
      <span className="hours-badge hours-badge-event" data-testid="hours-badge-event">
        {hours.label}: {formatRange(hours.openTime, hours.closeTime)}
      </span>
    );
  }

  if (!hours.openTime || !hours.closeTime) {
    return (
      <span className="hours-badge hours-badge-unknown" data-testid="hours-badge-unknown">
        Hours not set
      </span>
    );
  }

  return (
    <span className="hours-badge" data-testid="hours-badge-default">
      {formatRange(hours.openTime, hours.closeTime)}
    </span>
  );
}
