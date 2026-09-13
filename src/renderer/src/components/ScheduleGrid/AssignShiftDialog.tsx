import { useState } from 'react';
import type { EmployeeUnavailability, EndAnchor, ShiftTemplate, StartAnchor } from '@shared/types/domain';
import { isFullDayUnavailability } from '@shared/logic/unavailabilityConflict';
import { AnchorTimeField } from '../AnchorTimeField';
import { Modal } from '../Modal';

function formatUnavailabilityWindow(entry: EmployeeUnavailability): string {
  return isFullDayUnavailability(entry) ? 'All day' : `${entry.startTime}–${entry.endTime}`;
}

export interface CustomShiftInput {
  startAnchor: StartAnchor;
  startTime: string | null;
  endAnchor: EndAnchor;
  endTime: string | null;
}

interface AssignShiftDialogProps {
  employeeName: string;
  date: string;
  templates: ShiftTemplate[];
  /** This employee's APPROVED unavailability relevant to `date`'s day-of-week — informational, shown regardless of whether any assignment would actually conflict. */
  unavailability: EmployeeUnavailability[];
  isSaving: boolean;
  error: string | null;
  onAssign: (templateId: number) => void;
  onAssignCustom: (input: CustomShiftInput) => void;
  onClose: () => void;
}

type Mode = 'template' | 'custom';

export function AssignShiftDialog({
  employeeName,
  date,
  templates,
  unavailability,
  isSaving,
  error,
  onAssign,
  onAssignCustom,
  onClose,
}: AssignShiftDialogProps): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('custom');
  const [startAnchor, setStartAnchor] = useState<StartAnchor>('fixed');
  const [startTime, setStartTime] = useState('09:00');
  const [endAnchor, setEndAnchor] = useState<EndAnchor>('fixed');
  const [endTime, setEndTime] = useState('17:00');

  const handleCustomSubmit = (): void => {
    onAssignCustom({
      startAnchor,
      startTime: startAnchor === 'fixed' ? startTime : null,
      endAnchor,
      endTime: endAnchor === 'fixed' ? endTime : null,
    });
  };

  return (
    <Modal testId="assign-shift-dialog">
      <h2>Assign shift</h2>
      <p className="modal-subtitle">
        {employeeName} — {date}
      </p>
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}

      {unavailability.length > 0 && (
        <div className="unavailability-panel" data-testid="unavailability-panel">
          <strong>Stated unavailability for this day</strong>
          <ul>
            {unavailability.map((entry) => (
              <li key={entry.id} data-testid={`unavailability-entry-${entry.id}`}>
                {formatUnavailabilityWindow(entry)}
                {entry.reason ? ` — ${entry.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="assign-mode-toggle">
        <button
          type="button"
          className={mode === 'custom' ? 'btn btn-toggle active' : 'btn btn-toggle'}
          data-testid="assign-mode-custom"
          onClick={() => setMode('custom')}
        >
          Custom time
        </button>
        <button
          type="button"
          className={mode === 'template' ? 'btn btn-toggle active' : 'btn btn-toggle'}
          data-testid="assign-mode-template"
          onClick={() => setMode('template')}
        >
          From template
        </button>
      </div>

      {mode === 'template' &&
        (templates.length === 0 ? (
          <p>
            No active shift templates for this department yet. Add one on the Shift Templates page.
          </p>
        ) : (
          <ul className="template-picker-list">
            {templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  className="template-picker-option"
                  style={{ borderLeftColor: template.color }}
                  disabled={isSaving}
                  onClick={() => onAssign(template.id)}
                  data-testid={`assign-template-${template.id}`}
                >
                  <span>{template.name}</span>
                  <span className="template-picker-time">
                    {template.startAnchor === 'fixed' ? template.startTime : 'Open'}–
                    {template.endAnchor === 'fixed' ? template.endTime : 'Close'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {mode === 'custom' && (
        <div className="custom-shift-form">
          <p className="modal-subtitle">
            A one-off time for just this shift — nothing is saved to the template library.
          </p>
          <AnchorTimeField
            idPrefix="assign-custom-start"
            label="Start"
            liveAnchor="open"
            liveAnchorLabel="Opens with store"
            anchor={startAnchor}
            time={startTime}
            onAnchorChange={setStartAnchor}
            onTimeChange={setStartTime}
            disabled={isSaving}
          />
          <AnchorTimeField
            idPrefix="assign-custom-end"
            label="End"
            liveAnchor="close"
            liveAnchorLabel="Closes with store"
            anchor={endAnchor}
            time={endTime}
            onAnchorChange={setEndAnchor}
            onTimeChange={setEndTime}
            disabled={isSaving}
          />
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSaving}
              onClick={handleCustomSubmit}
              data-testid="assign-custom-submit"
            >
              Assign custom shift
            </button>
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
