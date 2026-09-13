import { useState } from 'react';
import type { ScheduledShift } from '@shared/types/domain';
import { formatEndEdge, formatStartEdge } from '../../utils/formatShiftTime';
import { Modal } from '../Modal';

interface EditShiftDialogProps {
  shift: ScheduledShift;
  employeeName: string;
  templateName: string | null;
  /** The shift's actual clock time for its date, already resolved — used to seed the inputs when the shift is anchored. */
  resolvedStartTime: string | null;
  resolvedEndTime: string | null;
  isSaving: boolean;
  error: string | null;
  onSaveOverride: (startTime: string, endTime: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function EditShiftDialog({
  shift,
  employeeName,
  templateName,
  resolvedStartTime,
  resolvedEndTime,
  isSaving,
  error,
  onSaveOverride,
  onRemove,
  onClose,
}: EditShiftDialogProps): React.JSX.Element {
  const [startTime, setStartTime] = useState(shift.startTime ?? resolvedStartTime ?? '');
  const [endTime, setEndTime] = useState(shift.endTime ?? resolvedEndTime ?? '');
  const isAnchored = shift.startAnchor !== 'fixed' || shift.endAnchor !== 'fixed';

  return (
    <Modal testId="edit-shift-dialog">
      <h2>Edit shift</h2>
      <p className="modal-subtitle">
        {employeeName} — {shift.shiftDate}
      </p>
      {templateName && (
        <p className="shift-template-note">
          Based on <strong>{templateName}</strong> template
          {shift.isOverride && ' (overridden)'}
        </p>
      )}
      {isAnchored && (
        <p className="shift-template-note" data-testid="edit-shift-anchor-note">
          Currently {formatStartEdge(shift.startAnchor, shift.startTime)}–
          {formatEndEdge(shift.endAnchor, shift.endTime)}, resolving to {resolvedStartTime ?? '?'}–
          {resolvedEndTime ?? '?'} today. Saving below sets a fixed time instead.
        </p>
      )}
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}

      <label className="field-label" htmlFor="edit-shift-start">
        Start time
        <input
          id="edit-shift-start"
          type="time"
          className="text-input"
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
        />
      </label>

      <label className="field-label" htmlFor="edit-shift-end">
        End time
        <input
          id="edit-shift-end"
          type="time"
          className="text-input"
          value={endTime}
          onChange={(event) => setEndTime(event.target.value)}
        />
      </label>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={isSaving}
          onClick={() => onSaveOverride(startTime, endTime)}
          data-testid="edit-shift-save"
        >
          Save changes
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={isSaving}
          onClick={onRemove}
          data-testid="edit-shift-remove"
        >
          Remove shift
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
