import type { CSSProperties } from 'react';
import type { ScheduledShift } from '@shared/types/domain';
import type { PreferenceMatchResult } from '@shared/logic/preferenceMatch';
import { formatEndEdge, formatStartEdge } from '../../utils/formatShiftTime';
import { PreferenceIndicator } from '../PreferenceIndicator';
import { SalariedTag } from '../SalariedTag';

interface ShiftCardProps {
  shift: ScheduledShift;
  color: string;
  isSalaried: boolean;
  preferenceMatch: PreferenceMatchResult;
  /** The shift's actual clock time for its date, already resolved through `resolveShiftTimeFromHours`. */
  resolvedStartTime: string | null;
  resolvedEndTime: string | null;
  /** Name of the shift template this shift was assigned from, or null for a one-off custom time. */
  templateName: string | null;
  onClick: () => void;
}

export function ShiftCard({
  shift,
  color,
  isSalaried,
  preferenceMatch,
  resolvedStartTime,
  resolvedEndTime,
  templateName,
  onClick,
}: ShiftCardProps): React.JSX.Element {
  const isAnchored = shift.startAnchor !== 'fixed' || shift.endAnchor !== 'fixed';
  const startLabel = formatStartEdge(shift.startAnchor, shift.startTime);
  const endLabel = formatEndEdge(shift.endAnchor, shift.endTime);
  const isResolved = resolvedStartTime !== null && resolvedEndTime !== null;

  return (
    <button
      type="button"
      className="shift-card"
      style={{ '--shift-color': color } as CSSProperties}
      tabIndex={-1}
      onClick={onClick}
      data-testid={`shift-card-${shift.id}`}
    >
      <span className="shift-card-time">
        {startLabel}–{endLabel}
      </span>
      {isAnchored && (
        <span
          className="shift-card-anchor-note"
          data-testid={
            isResolved
              ? `shift-card-anchor-note-${shift.id}`
              : `shift-card-anchor-unresolved-${shift.id}`
          }
        >
          {isResolved
            ? `Resolves to ${resolvedStartTime}–${resolvedEndTime}`
            : 'Store closed this day — time not set'}
        </span>
      )}
      {(isSalaried || preferenceMatch !== 'none') && (
        <span className="shift-card-tags">
          {isSalaried && <SalariedTag />}
          <PreferenceIndicator result={preferenceMatch} />
        </span>
      )}
      {shift.isOverride && (
        <span className="shift-card-edited" data-testid={`shift-card-edited-${shift.id}`}>
          Edited
        </span>
      )}
      {!shift.isOverride && shift.templateId !== null && templateName && (
        <span className="shift-card-template" data-testid={`shift-card-template-${shift.id}`}>
          {templateName}
        </span>
      )}
    </button>
  );
}
