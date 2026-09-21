import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { DAY_OF_WEEK_LABELS } from '@shared/types/domain';
import type { SpecialEventOverride, StoreHours } from '@shared/types/domain';
import { getTodayIso } from '@shared/logic/weekRange';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconStar } from '../components/icons';
import {
  useCreateSpecialEvent,
  useRemoveSpecialEvent,
  useSpecialEvents,
  useUpdateSpecialEvent,
} from '../hooks/useSpecialEvents';
import { useStoreHours, useUpsertStoreHours } from '../hooks/useStoreHours';
import { formatClockTime } from '../utils/formatShiftTime';
import { useTimeFormat } from '../settings/TimeFormatProvider';

interface DayRowState {
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

const DEFAULT_ROW: DayRowState = { openTime: '10:00', closeTime: '22:00', isClosed: false };

function buildRows(storeHours: StoreHours[] | undefined): Record<number, DayRowState> {
  const rows: Record<number, DayRowState> = {};
  for (let day = 0; day < DAY_OF_WEEK_LABELS.length; day += 1) {
    const existing = storeHours?.find((h) => h.dayOfWeek === day);
    rows[day] = existing
      ? {
          openTime: existing.openTime ?? DEFAULT_ROW.openTime,
          closeTime: existing.closeTime ?? DEFAULT_ROW.closeTime,
          isClosed: existing.isClosed,
        }
      : { ...DEFAULT_ROW };
  }
  return rows;
}

interface EventFormState {
  id: number | null;
  eventDate: string;
  label: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

const EMPTY_EVENT_FORM: EventFormState = {
  id: null,
  eventDate: '',
  label: '',
  openTime: '10:00',
  closeTime: '22:00',
  isClosed: false,
};

function toEventFormState(event: SpecialEventOverride): EventFormState {
  return {
    id: event.id,
    eventDate: event.eventDate,
    label: event.label,
    openTime: event.openTime ?? DEFAULT_ROW.openTime,
    closeTime: event.closeTime ?? DEFAULT_ROW.closeTime,
    isClosed: event.isClosed,
  };
}

/** Manager-only weekly-default hours editor, one row per day-of-week, saved independently per row. */
function WeeklyHoursCard(): React.JSX.Element {
  const { data: storeHours, isLoading, error } = useStoreHours();
  const upsertStoreHours = useUpsertStoreHours();

  const [rows, setRows] = useState<Record<number, DayRowState>>(() => buildRows(undefined));
  const [savedDay, setSavedDay] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (storeHours) {
      setRows(buildRows(storeHours));
    }
  }, [storeHours]);

  const updateRow = (day: number, patch: Partial<DayRowState>): void => {
    setRows((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
    setSavedDay(null);
  };

  const handleSaveDay = async (day: number): Promise<void> => {
    setRowErrors((prev) => ({ ...prev, [day]: '' }));
    const row = rows[day];
    try {
      await upsertStoreHours.mutateAsync({
        dayOfWeek: day,
        openTime: row.isClosed ? null : row.openTime,
        closeTime: row.isClosed ? null : row.closeTime,
        isClosed: row.isClosed,
      });
      setSavedDay(day);
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [day]: err instanceof Error ? err.message : 'Could not save hours',
      }));
    }
  };

  return (
    <div className="card section" data-testid="store-hours-card">
      <h2>Weekly default hours</h2>
      <p className="modal-subtitle">
        Applies every week unless a special event override below replaces a specific date.
      </p>

      {isLoading && <LoadingState label="Loading store hours…" />}
      {error && (
        <div role="alert" className="form-error">
          {error instanceof Error ? error.message : 'Failed to load store hours'}
        </div>
      )}

      <table className="data-table" data-testid="store-hours-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Open</th>
            <th>Close</th>
            <th>Closed</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {DAY_OF_WEEK_LABELS.map((label, day) => {
            const row = rows[day];
            return (
              <tr key={label}>
                <td>{label}</td>
                <td>
                  <input
                    type="time"
                    className="text-input"
                    aria-label={`${label} open time`}
                    data-testid={`store-hours-open-${day}`}
                    value={row.openTime}
                    disabled={row.isClosed}
                    onChange={(event) => updateRow(day, { openTime: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    className="text-input"
                    aria-label={`${label} close time`}
                    data-testid={`store-hours-close-${day}`}
                    value={row.closeTime}
                    disabled={row.isClosed}
                    onChange={(event) => updateRow(day, { closeTime: event.target.value })}
                  />
                </td>
                <td>
                  <label className="table-checkbox-tap" htmlFor={`store-hours-closed-${day}`}>
                    <input
                      id={`store-hours-closed-${day}`}
                      type="checkbox"
                      aria-label={`${label} closed`}
                      data-testid={`store-hours-closed-${day}`}
                      checked={row.isClosed}
                      onChange={(event) => updateRow(day, { isClosed: event.target.checked })}
                    />
                  </label>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-link"
                    data-testid={`store-hours-save-${day}`}
                    disabled={upsertStoreHours.isPending}
                    onClick={() => {
                      handleSaveDay(day);
                    }}
                  >
                    Save
                  </button>
                  {savedDay === day && (
                    <span
                      className="tag tag-success tag-inline-gap"
                      data-testid={`store-hours-saved-${day}`}
                    >
                      Saved
                    </span>
                  )}
                  {rowErrors[day] && (
                    <div role="alert" className="form-error error-tight">
                      {rowErrors[day]}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Manager-only special-event override CRUD: add/edit a one-off date's hours (or full closure) plus a required label. */
function SpecialEventsCard(): React.JSX.Element {
  const { timeFormat } = useTimeFormat();
  const { data: specialEvents, isLoading, error } = useSpecialEvents();
  const createEvent = useCreateSpecialEvent();
  const updateEvent = useUpdateSpecialEvent();
  const removeEvent = useRemoveSpecialEvent();

  const [form, setForm] = useState<EventFormState>(EMPTY_EVENT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = form.id !== null;

  const resetForm = (): void => {
    setForm(EMPTY_EVENT_FORM);
    setFormError(null);
  };

  const today = getTodayIso();
  const upcomingEvents = (specialEvents ?? [])
    .filter((event) => event.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    const payload = {
      eventDate: form.eventDate,
      label: form.label,
      isClosed: form.isClosed,
      openTime: form.isClosed ? null : form.openTime,
      closeTime: form.isClosed ? null : form.closeTime,
    };
    try {
      if (isEditing && form.id !== null) {
        await updateEvent.mutateAsync({ id: form.id, ...payload });
      } else {
        await createEvent.mutateAsync(payload);
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save special event');
    }
  };

  const handleRemove = async (id: number): Promise<void> => {
    await removeEvent.mutateAsync(id);
    if (form.id === id) {
      resetForm();
    }
  };

  const isSaving = createEvent.isPending || updateEvent.isPending;

  return (
    <>
      <div className="card section">
        <h2>Special event overrides</h2>
        <p className="modal-subtitle">
          One-off date overrides — custom hours or fully closed — shown as a badge on the schedule
          board.
        </p>

        {isLoading && <LoadingState label="Loading special events…" />}
        {error && (
          <div role="alert" className="form-error">
            {error instanceof Error ? error.message : 'Failed to load special events'}
          </div>
        )}
        {!isLoading && upcomingEvents.length === 0 && (
          <EmptyState
            icon={<IconStar />}
            title="No upcoming special events"
            body="Add a one-off date override below — for a league night, holiday hours, or a full closure."
          />
        )}
        {upcomingEvents.length > 0 && (
          <table className="data-table" data-testid="special-events-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Label</th>
                <th>Hours</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {upcomingEvents.map((eventItem) => (
                <tr key={eventItem.id}>
                  <td>{eventItem.eventDate}</td>
                  <td>{eventItem.label}</td>
                  <td>
                    {eventItem.isClosed || !eventItem.openTime || !eventItem.closeTime
                      ? 'Closed'
                      : `${formatClockTime(eventItem.openTime, timeFormat)}–${formatClockTime(eventItem.closeTime, timeFormat)}`}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-link"
                      data-testid={`special-event-edit-${eventItem.id}`}
                      onClick={() => setForm(toEventFormState(eventItem))}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-link"
                      data-testid={`special-event-remove-${eventItem.id}`}
                      onClick={() => {
                        handleRemove(eventItem.id);
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>{isEditing ? `Edit special event (${form.eventDate})` : 'Add special event'}</h2>
        <form
          onSubmit={(event) => {
            handleSubmit(event);
          }}
        >
          {formError && (
            <div role="alert" className="form-error">
              {formError}
            </div>
          )}

          <div className="form-rows">
            <label className="form-row" htmlFor="special-event-date">
              <span className="form-row-label">Date</span>
              <input
                id="special-event-date"
                type="date"
                className="text-input"
                value={form.eventDate}
                disabled={isEditing}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, eventDate: event.target.value }))
                }
                required
              />
            </label>

            <label className="form-row" htmlFor="special-event-label">
              <span className="form-row-label">Label</span>
              <input
                id="special-event-label"
                className="text-input"
                value={form.label}
                placeholder="Tournament - Opens at 8am"
                onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                required
              />
            </label>

            <label className="checkbox-row" htmlFor="special-event-closed">
              <input
                id="special-event-closed"
                type="checkbox"
                checked={form.isClosed}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, isClosed: event.target.checked }))
                }
              />
              Fully closed this date
            </label>

            {!form.isClosed && (
              <>
                <label className="form-row" htmlFor="special-event-open">
                  <span className="form-row-label">Open</span>
                  <input
                    id="special-event-open"
                    type="time"
                    className="text-input"
                    value={form.openTime}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, openTime: event.target.value }))
                    }
                    required={!form.isClosed}
                  />
                </label>

                <label className="form-row" htmlFor="special-event-close">
                  <span className="form-row-label">Close</span>
                  <input
                    id="special-event-close"
                    type="time"
                    className="text-input"
                    value={form.closeTime}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, closeTime: event.target.value }))
                    }
                    required={!form.isClosed}
                  />
                </label>
              </>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              data-testid="special-event-submit"
            >
              {isEditing ? 'Save changes' : 'Add special event'}
            </button>
            {isEditing && (
              <button type="button" className="btn" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}

export function StoreHoursAdminPage(): React.JSX.Element {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Store Hours</h1>
      </div>

      <WeeklyHoursCard />
      <SpecialEventsCard />
    </div>
  );
}
