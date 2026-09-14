import { useState } from 'react';
import type { FormEvent } from 'react';
import { DAY_OF_WEEK_LABELS } from '@shared/types/domain';
import { isFullDayUnavailability } from '@shared/logic/unavailabilityConflict';
import { EmployeeSelect } from '../components/EmployeeSelect';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconCalendarOff } from '../components/icons';
import { useEmployees } from '../hooks/useEmployees';
import { useSessionStore } from '../store/useSessionStore';
import { formatClockTime } from '../utils/formatShiftTime';
import { useTimeFormat } from '../settings/TimeFormatProvider';
import {
  useCreateTimeOffForEmployee,
  useCreateTimeOffRequest,
  useOwnTimeOffRequests,
} from '../hooks/useTimeOff';
import {
  useCreateUnavailability,
  useCreateUnavailabilityForEmployee,
  useOwnUnavailability,
} from '../hooks/useUnavailability';

interface TimeOffFormState {
  startDate: string;
  endDate: string;
  reason: string;
}

const EMPTY_TIME_OFF_FORM: TimeOffFormState = { startDate: '', endDate: '', reason: '' };

interface UnavailabilityFormState {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  fullDay: boolean;
  reason: string;
}

const EMPTY_UNAVAILABILITY_FORM: UnavailabilityFormState = {
  dayOfWeek: 0,
  startTime: '09:00',
  endTime: '17:00',
  fullDay: false,
  reason: '',
};

export function RequestTimeOffPage(): React.JSX.Element {
  const { timeFormat } = useTimeFormat();
  const currentEmployee = useSessionStore((state) => state.currentEmployee);
  const isManager = currentEmployee?.role === 'manager';
  const { data: employees } = useEmployees();

  const { data: requests, isLoading, error } = useOwnTimeOffRequests();
  const createRequest = useCreateTimeOffRequest();
  const createRequestForEmployee = useCreateTimeOffForEmployee();

  const {
    data: unavailability,
    isLoading: isUnavailabilityLoading,
    error: unavailabilityError,
  } = useOwnUnavailability();
  const createUnavailability = useCreateUnavailability();
  const createUnavailabilityForEmployee = useCreateUnavailabilityForEmployee();

  const [form, setForm] = useState<TimeOffFormState>(EMPTY_TIME_OFF_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [onBehalfOfId, setOnBehalfOfId] = useState<number | null>(null);

  const [unavailabilityForm, setUnavailabilityForm] = useState<UnavailabilityFormState>(
    EMPTY_UNAVAILABILITY_FORM,
  );
  const [unavailabilityFormError, setUnavailabilityFormError] = useState<string | null>(null);
  const [unavailabilityOnBehalfOfId, setUnavailabilityOnBehalfOfId] = useState<number | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    try {
      if (isManager && onBehalfOfId !== null) {
        await createRequestForEmployee.mutateAsync({
          employeeId: onBehalfOfId,
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason || undefined,
        });
      } else {
        await createRequest.mutateAsync({
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason || undefined,
        });
      }
      setForm(EMPTY_TIME_OFF_FORM);
      setOnBehalfOfId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit time-off request');
    }
  };

  const handleUnavailabilitySubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setUnavailabilityFormError(null);
    const startTime = unavailabilityForm.fullDay ? '00:00' : unavailabilityForm.startTime;
    const endTime = unavailabilityForm.fullDay ? '23:59' : unavailabilityForm.endTime;
    try {
      if (isManager && unavailabilityOnBehalfOfId !== null) {
        await createUnavailabilityForEmployee.mutateAsync({
          employeeId: unavailabilityOnBehalfOfId,
          dayOfWeek: unavailabilityForm.dayOfWeek,
          startTime,
          endTime,
          reason: unavailabilityForm.reason || undefined,
        });
      } else {
        await createUnavailability.mutateAsync({
          dayOfWeek: unavailabilityForm.dayOfWeek,
          startTime,
          endTime,
          reason: unavailabilityForm.reason || undefined,
        });
      }
      setUnavailabilityForm(EMPTY_UNAVAILABILITY_FORM);
      setUnavailabilityOnBehalfOfId(null);
    } catch (err) {
      setUnavailabilityFormError(
        err instanceof Error ? err.message : 'Could not submit unavailability request',
      );
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Request Time Off</h1>
      </div>

      <div className="card section">
        <h2>Submit a time-off request</h2>
        <form
          className="form-grid"
          onSubmit={(event) => {
            handleSubmit(event);
          }}
        >
          {formError && (
            <div role="alert" className="form-error">
              {formError}
            </div>
          )}

          {isManager && (
            <EmployeeSelect
              id="timeoff-on-behalf-of"
              label="Submit on behalf of (optional — auto-approved)"
              employees={employees ?? []}
              value={onBehalfOfId}
              onChange={setOnBehalfOfId}
            />
          )}

          <label className="field-label" htmlFor="timeoff-start">
            Start date
            <input
              id="timeoff-start"
              type="date"
              className="text-input"
              value={form.startDate}
              onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
              required
            />
          </label>

          <label className="field-label" htmlFor="timeoff-end">
            End date
            <input
              id="timeoff-end"
              type="date"
              className="text-input"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
              required
            />
          </label>

          <label className="field-label" htmlFor="timeoff-reason">
            Reason (optional)
            <input
              id="timeoff-reason"
              className="text-input"
              value={form.reason}
              onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
            />
          </label>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createRequest.isPending || createRequestForEmployee.isPending}
              data-testid="timeoff-submit"
            >
              {isManager && onBehalfOfId !== null ? 'Submit (auto-approved)' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Your requests</h2>
        {isLoading && <LoadingState />}
        {error && (
          <div role="alert" className="form-error">
            {error instanceof Error ? error.message : 'Failed to load your requests'}
          </div>
        )}
        {requests && requests.length === 0 && (
          <EmptyState
            icon={<IconCalendarOff />}
            title="No time-off requests yet"
            body="Submit a request above and it will show up here with its status."
          />
        )}
        {requests && requests.length > 0 && (
          <table className="data-table" data-testid="my-timeoff-table">
            <thead>
              <tr>
                <th>Dates</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} data-testid={`my-timeoff-row-${request.id}`}>
                  <td>
                    {request.startDate} – {request.endDate}
                  </td>
                  <td>{request.reason ?? '—'}</td>
                  <td>
                    <span
                      className={`tag tag-status-${request.status}`}
                      data-testid={`my-timeoff-status-${request.id}`}
                    >
                      {request.status}
                    </span>
                    {request.status === 'denied' && request.decisionNote && (
                      <p className="shift-template-note">Manager note: {request.decisionNote}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="page-header">
        <h1>Recurring Unavailability</h1>
      </div>

      <div className="card section">
        <h2>Submit unavailability</h2>
        <p className="modal-subtitle">
          A recurring day-of-week and time window you cannot work — distinct from a one-off
          time-off request above. Goes through the same manager-approval workflow.
        </p>
        <form
          className="form-grid"
          onSubmit={(event) => {
            handleUnavailabilitySubmit(event);
          }}
        >
          {unavailabilityFormError && (
            <div role="alert" className="form-error">
              {unavailabilityFormError}
            </div>
          )}

          {isManager && (
            <EmployeeSelect
              id="unavailability-on-behalf-of"
              label="Submit on behalf of (optional — auto-approved)"
              employees={employees ?? []}
              value={unavailabilityOnBehalfOfId}
              onChange={setUnavailabilityOnBehalfOfId}
            />
          )}

          <label className="field-label" htmlFor="unavailability-day">
            Day of week
            <select
              id="unavailability-day"
              className="text-input"
              value={unavailabilityForm.dayOfWeek}
              onChange={(event) =>
                setUnavailabilityForm((prev) => ({
                  ...prev,
                  dayOfWeek: Number(event.target.value),
                }))
              }
            >
              {DAY_OF_WEEK_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-row" htmlFor="unavailability-full-day">
            <input
              id="unavailability-full-day"
              type="checkbox"
              checked={unavailabilityForm.fullDay}
              onChange={(event) =>
                setUnavailabilityForm((prev) => ({ ...prev, fullDay: event.target.checked }))
              }
            />
            Unavailable all day
          </label>

          {!unavailabilityForm.fullDay && (
            <>
              <label className="field-label" htmlFor="unavailability-start">
                Start time
                <input
                  id="unavailability-start"
                  type="time"
                  className="text-input"
                  value={unavailabilityForm.startTime}
                  onChange={(event) =>
                    setUnavailabilityForm((prev) => ({ ...prev, startTime: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="field-label" htmlFor="unavailability-end">
                End time
                <input
                  id="unavailability-end"
                  type="time"
                  className="text-input"
                  value={unavailabilityForm.endTime}
                  onChange={(event) =>
                    setUnavailabilityForm((prev) => ({ ...prev, endTime: event.target.value }))
                  }
                  required
                />
              </label>
            </>
          )}

          <label className="field-label" htmlFor="unavailability-reason">
            Reason (optional)
            <input
              id="unavailability-reason"
              className="text-input"
              value={unavailabilityForm.reason}
              onChange={(event) =>
                setUnavailabilityForm((prev) => ({ ...prev, reason: event.target.value }))
              }
            />
          </label>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createUnavailability.isPending || createUnavailabilityForEmployee.isPending}
              data-testid="unavailability-submit"
            >
              {isManager && unavailabilityOnBehalfOfId !== null
                ? 'Submit (auto-approved)'
                : 'Submit request'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Your unavailability</h2>
        {isUnavailabilityLoading && <LoadingState />}
        {unavailabilityError && (
          <div role="alert" className="form-error">
            {unavailabilityError instanceof Error
              ? unavailabilityError.message
              : 'Failed to load your unavailability'}
          </div>
        )}
        {unavailability && unavailability.length === 0 && (
          <EmptyState
            icon={<IconCalendarOff />}
            title="No unavailability on file"
            body="Submit a recurring day/time window above and it will show up here with its status."
          />
        )}
        {unavailability && unavailability.length > 0 && (
          <table className="data-table" data-testid="my-unavailability-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Window</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {unavailability.map((entry) => (
                <tr key={entry.id} data-testid={`my-unavailability-row-${entry.id}`}>
                  <td>{DAY_OF_WEEK_LABELS[entry.dayOfWeek]}</td>
                  <td>
                    {isFullDayUnavailability(entry)
                      ? 'All day'
                      : `${formatClockTime(entry.startTime, timeFormat)}–${formatClockTime(entry.endTime, timeFormat)}`}
                  </td>
                  <td>{entry.reason ?? '—'}</td>
                  <td>
                    <span
                      className={`tag tag-status-${entry.status}`}
                      data-testid={`my-unavailability-status-${entry.id}`}
                    >
                      {entry.status}
                    </span>
                    {entry.status === 'denied' && entry.decisionNote && (
                      <p className="shift-template-note">Manager note: {entry.decisionNote}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
