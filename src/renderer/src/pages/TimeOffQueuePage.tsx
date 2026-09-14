import { useMemo, useState } from 'react';
import { DAY_OF_WEEK_LABELS } from '@shared/types/domain';
import { isFullDayUnavailability } from '@shared/logic/unavailabilityConflict';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconCalendarOff } from '../components/icons';
import { Modal } from '../components/Modal';
import { useEmployees } from '../hooks/useEmployees';
import { useAllTimeOffRequests, useDecideTimeOffRequest } from '../hooks/useTimeOff';
import { useAllUnavailability, useDecideUnavailability } from '../hooks/useUnavailability';
import { formatClockTime } from '../utils/formatShiftTime';
import { useTimeFormat } from '../settings/TimeFormatProvider';

type QueueKind = 'timeOff' | 'unavailability';

const QUEUE_KINDS: Array<{ value: QueueKind; label: string }> = [
  { value: 'timeOff', label: 'Time Off' },
  { value: 'unavailability', label: 'Unavailability' },
];

type StatusFilter = 'pending' | 'approved' | 'denied' | 'all';

const STATUS_FILTERS: StatusFilter[] = ['pending', 'approved', 'denied', 'all'];

function statusFilterLabel(status: StatusFilter): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

interface DenyTarget {
  queueKind: QueueKind;
  id: number;
}

export function TimeOffQueuePage(): React.JSX.Element {
  const { timeFormat } = useTimeFormat();
  const [queueKind, setQueueKind] = useState<QueueKind>('timeOff');

  const { data: requests, isLoading, error } = useAllTimeOffRequests();
  const decideTimeOff = useDecideTimeOffRequest();

  const {
    data: unavailabilityRequests,
    isLoading: isUnavailabilityLoading,
    error: unavailabilityError,
  } = useAllUnavailability();
  const decideUnavailability = useDecideUnavailability();

  const { data: employees } = useEmployees();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [denyTarget, setDenyTarget] = useState<DenyTarget | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const isDeciding = decideTimeOff.isPending || decideUnavailability.isPending;

  const employeeNameById = useMemo(() => {
    const map = new Map<number, string>();
    (employees ?? []).forEach((employee) => map.set(employee.id, employee.name));
    return map;
  }, [employees]);

  const pendingTimeOffCount = useMemo(
    () => (requests ?? []).filter((request) => request.status === 'pending').length,
    [requests],
  );
  const pendingUnavailabilityCount = useMemo(
    () => (unavailabilityRequests ?? []).filter((request) => request.status === 'pending').length,
    [unavailabilityRequests],
  );
  const pendingCount = queueKind === 'timeOff' ? pendingTimeOffCount : pendingUnavailabilityCount;

  const filteredRequests = useMemo(() => {
    const all = requests ?? [];
    return statusFilter === 'all' ? all : all.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  const filteredUnavailability = useMemo(() => {
    const all = unavailabilityRequests ?? [];
    return statusFilter === 'all' ? all : all.filter((request) => request.status === statusFilter);
  }, [unavailabilityRequests, statusFilter]);

  const handleApprove = async (kind: QueueKind, id: number): Promise<void> => {
    setActionError(null);
    try {
      if (kind === 'timeOff') {
        await decideTimeOff.mutateAsync({ id, status: 'approved' });
      } else {
        await decideUnavailability.mutateAsync({ id, status: 'approved' });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not approve request');
    }
  };

  const openDenyDialog = (kind: QueueKind, id: number): void => {
    setActionError(null);
    setDecisionNote('');
    setDenyTarget({ queueKind: kind, id });
  };

  const handleDenyConfirm = async (): Promise<void> => {
    if (!denyTarget) return;
    setActionError(null);
    try {
      if (denyTarget.queueKind === 'timeOff') {
        await decideTimeOff.mutateAsync({
          id: denyTarget.id,
          status: 'denied',
          decisionNote: decisionNote || undefined,
        });
      } else {
        await decideUnavailability.mutateAsync({
          id: denyTarget.id,
          status: 'denied',
          decisionNote: decisionNote || undefined,
        });
      }
      setDenyTarget(null);
      setDecisionNote('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not deny request');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Time Off Queue</h1>
        {pendingCount > 0 && <span className="tag tag-status-pending">{pendingCount} pending</span>}
      </div>

      <div className="department-tabs" role="tablist" aria-label="Queue">
        {QUEUE_KINDS.map(({ value, label }) => {
          const isActive = queueKind === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={isActive ? 'department-tab active' : 'department-tab'}
              onClick={() => setQueueKind(value)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="department-tabs" role="tablist" aria-label="Status filter">
        {STATUS_FILTERS.map((status) => {
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={isActive ? 'department-tab active' : 'department-tab'}
              onClick={() => setStatusFilter(status)}
            >
              {statusFilterLabel(status)}
            </button>
          );
        })}
      </div>

      {actionError && (
        <div role="alert" className="form-error">
          {actionError}
        </div>
      )}

      {queueKind === 'timeOff' && (
        <div className="card">
          {isLoading && <LoadingState label="Loading requests…" />}
          {error && (
            <div role="alert" className="form-error">
              {error instanceof Error ? error.message : 'Failed to load time-off requests'}
            </div>
          )}
          {filteredRequests.length === 0 && !isLoading && (
            <EmptyState
              icon={<IconCalendarOff />}
              title="No requests to show"
              body="Nothing matches this filter right now."
            />
          )}
          {filteredRequests.length > 0 && (
            <table className="data-table" data-testid="timeoff-queue-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id} data-testid={`timeoff-queue-row-${request.id}`}>
                    <td>
                      {employeeNameById.get(request.employeeId) ?? `Employee #${request.employeeId}`}
                    </td>
                    <td>
                      {request.startDate} – {request.endDate}
                    </td>
                    <td>{request.reason ?? '—'}</td>
                    <td>
                      <span className={`tag tag-status-${request.status}`}>{request.status}</span>
                      {request.status === 'denied' && request.decisionNote && (
                        <p className="shift-template-note">{request.decisionNote}</p>
                      )}
                    </td>
                    <td>
                      {request.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-link"
                            disabled={isDeciding}
                            onClick={() => {
                              handleApprove('timeOff', request.id);
                            }}
                            data-testid={`timeoff-approve-${request.id}`}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-link"
                            disabled={isDeciding}
                            onClick={() => openDenyDialog('timeOff', request.id)}
                            data-testid={`timeoff-deny-${request.id}`}
                          >
                            Deny
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {queueKind === 'unavailability' && (
        <div className="card">
          {isUnavailabilityLoading && <LoadingState label="Loading requests…" />}
          {unavailabilityError && (
            <div role="alert" className="form-error">
              {unavailabilityError instanceof Error
                ? unavailabilityError.message
                : 'Failed to load unavailability requests'}
            </div>
          )}
          {filteredUnavailability.length === 0 && !isUnavailabilityLoading && (
            <EmptyState
              icon={<IconCalendarOff />}
              title="No requests to show"
              body="Nothing matches this filter right now."
            />
          )}
          {filteredUnavailability.length > 0 && (
            <table className="data-table" data-testid="unavailability-queue-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Day</th>
                  <th>Window</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredUnavailability.map((request) => (
                  <tr key={request.id} data-testid={`unavailability-queue-row-${request.id}`}>
                    <td>
                      {employeeNameById.get(request.employeeId) ?? `Employee #${request.employeeId}`}
                    </td>
                    <td>{DAY_OF_WEEK_LABELS[request.dayOfWeek]}</td>
                    <td>
                      {isFullDayUnavailability(request)
                        ? 'All day'
                        : `${formatClockTime(request.startTime, timeFormat)}–${formatClockTime(request.endTime, timeFormat)}`}
                    </td>
                    <td>{request.reason ?? '—'}</td>
                    <td>
                      <span className={`tag tag-status-${request.status}`}>{request.status}</span>
                      {request.status === 'denied' && request.decisionNote && (
                        <p className="shift-template-note">{request.decisionNote}</p>
                      )}
                    </td>
                    <td>
                      {request.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-link"
                            disabled={isDeciding}
                            onClick={() => {
                              handleApprove('unavailability', request.id);
                            }}
                            data-testid={`unavailability-approve-${request.id}`}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-link"
                            disabled={isDeciding}
                            onClick={() => openDenyDialog('unavailability', request.id)}
                            data-testid={`unavailability-deny-${request.id}`}
                          >
                            Deny
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {denyTarget !== null && (
        <Modal testId="deny-timeoff-dialog">
          <h2>{denyTarget.queueKind === 'timeOff' ? 'Deny time-off request' : 'Deny unavailability request'}</h2>
          <label className="field-label" htmlFor="deny-timeoff-note">
            Decision note (optional, shown to the employee)
            <textarea
              id="deny-timeoff-note"
              className="text-input"
              rows={3}
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDeciding}
              onClick={() => {
                handleDenyConfirm();
              }}
              data-testid="deny-timeoff-confirm"
            >
              Deny request
            </button>
            <button type="button" className="btn" onClick={() => setDenyTarget(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
