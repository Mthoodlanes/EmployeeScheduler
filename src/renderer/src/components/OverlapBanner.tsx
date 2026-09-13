import { DEPARTMENT_LABELS } from '@shared/types/domain';
import type { OverlapShiftInfo, OverlapWarning } from '@shared/logic/overlapDetection';
import { formatDayLabel } from '@shared/logic/weekRange';
import { IconWarningTriangle } from './icons';

interface OverlapBannerProps {
  warnings: OverlapWarning[];
}

function formatShift(shift: OverlapShiftInfo): string {
  return `${DEPARTMENT_LABELS[shift.department]} ${shift.start}–${shift.end}`;
}

/**
 * Non-blocking, cross-department overlap warning shown on the Schedule Board
 * regardless of which department tab is active — a conflict may involve two
 * OTHER departments entirely. Renders nothing when there are no conflicts,
 * rather than an empty, scary-looking container.
 */
export function OverlapBanner({ warnings }: OverlapBannerProps): React.JSX.Element | null {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="overlap-banner" role="alert" data-testid="overlap-banner">
      <strong className="overlap-banner-title">
        <span aria-hidden="true">
          <IconWarningTriangle />
        </span>
        {warnings.length === 1
          ? '1 scheduling conflict detected'
          : `${warnings.length} scheduling conflicts detected`}
      </strong>
      <ul className="overlap-banner-list">
        {warnings.map((warning) => (
          <li
            key={`${warning.employeeId}-${warning.date}-${warning.shiftA.shiftId}-${warning.shiftB.shiftId}`}
            data-testid={`overlap-warning-${warning.shiftA.shiftId}-${warning.shiftB.shiftId}`}
          >
            {warning.employeeName} is double-booked on {formatDayLabel(warning.date)}:{' '}
            {formatShift(warning.shiftA)} and {formatShift(warning.shiftB)}.
          </li>
        ))}
      </ul>
    </div>
  );
}
