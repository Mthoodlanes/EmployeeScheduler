import { useMemo, useState } from 'react';
import type { ShiftTemplate } from '@shared/types/domain';
import { DEPARTMENT_LABELS } from '@shared/types/domain';
import {
  formatDayLabel,
  formatWeekLabel,
  getDayOfWeek,
  getTodayIso,
  getWeekDates,
  getWeekStart,
  shiftWeek,
} from '@shared/logic/weekRange';
import { resolveHoursForDate, resolveShiftTimeFromHours } from '@shared/logic/hoursResolution';
import { matchPreference } from '@shared/logic/preferenceMatch';
import { buildMyScheduleDays } from '@shared/logic/myScheduleDay';
import { isFullDayUnavailability } from '@shared/logic/unavailabilityConflict';
import { LoadingState } from '../components/EmptyState';
import { ShiftCard } from '../components/ScheduleGrid/ShiftCard';
import { SpecialEventBadge } from '../components/SpecialEventBadge';
import { useEmployeePreferences } from '../hooks/useEmployeePreferences';
import { useAllDepartmentsScheduleWeek } from '../hooks/useMySchedule';
import { useShiftTemplates } from '../hooks/useShiftTemplates';
import { useSpecialEvents } from '../hooks/useSpecialEvents';
import { useStoreHours } from '../hooks/useStoreHours';
import { useOwnTimeOffRequests } from '../hooks/useTimeOff';
import { useOwnUnavailability } from '../hooks/useUnavailability';
import { useSessionStore } from '../store/useSessionStore';

const DEFAULT_SHIFT_COLOR = '#94a3b8';

/**
 * Read-only "what does my week look like" view for the logged-in employee —
 * their own shifts across every department they belong to, plus any
 * approved time off/unavailability affecting the week. No assign/edit
 * actions live here; that's the manager-only Schedule Board
 * (`ScheduleBoardPage`). Reuses the exact same week-navigation, hours-
 * resolution and shift-card rendering the schedule board uses so a shift
 * looks and resolves identically in both places.
 */
export function MySchedulePage(): React.JSX.Element {
  const currentEmployee = useSessionStore((state) => state.currentEmployee);
  const [weekStart, setWeekStart] = useState<string>(() => getWeekStart(getTodayIso()));

  const { shifts, isLoading: shiftsLoading } = useAllDepartmentsScheduleWeek(weekStart);
  const { data: storeHours } = useStoreHours();
  const { data: specialEvents } = useSpecialEvents();
  const { data: templates } = useShiftTemplates();
  const { data: preferences } = useEmployeePreferences();
  const { data: timeOffRequests, isLoading: timeOffLoading } = useOwnTimeOffRequests();
  const { data: unavailability, isLoading: unavailabilityLoading } = useOwnUnavailability();

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const dayInputs = useMemo(
    () =>
      weekDates.map((date) => ({
        date,
        label: formatDayLabel(date),
        hours: resolveHoursForDate(date, storeHours ?? [], specialEvents ?? []),
      })),
    [weekDates, storeHours, specialEvents],
  );

  const templatesById = useMemo(() => {
    const map = new Map<number, ShiftTemplate>();
    (templates ?? []).forEach((template) => map.set(template.id, template));
    return map;
  }, [templates]);

  const days = useMemo(
    () =>
      currentEmployee
        ? buildMyScheduleDays(
            dayInputs,
            currentEmployee.id,
            shifts,
            timeOffRequests ?? [],
            unavailability ?? [],
          )
        : [],
    [dayInputs, currentEmployee, shifts, timeOffRequests, unavailability],
  );

  const ownPreferences = useMemo(
    () => (preferences ?? []).filter((preference) => preference.employeeId === currentEmployee?.id),
    [preferences, currentEmployee],
  );

  const isLoading = shiftsLoading || timeOffLoading || unavailabilityLoading;

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Schedule</h1>
      </div>

      <div className="week-nav">
        <button
          type="button"
          className="btn"
          onClick={() => setWeekStart((prev) => shiftWeek(prev, -1))}
        >
          ← Previous week
        </button>
        <span className="week-nav-label" data-testid="week-label">
          {formatWeekLabel(weekStart)}
        </span>
        <button
          type="button"
          className="btn"
          onClick={() => setWeekStart((prev) => shiftWeek(prev, 1))}
        >
          Next week →
        </button>
      </div>

      {isLoading && <LoadingState />}

      <div className="my-schedule-days">
        {days.map((day) => {
          const isOff = day.shifts.length === 0 && !day.isApprovedTimeOff;

          return (
            <div
              className="card my-schedule-day"
              key={day.date}
              data-testid={`my-schedule-day-${day.date}`}
            >
              <div className="my-schedule-day-header">
                <span className="my-schedule-day-label">{day.label}</span>
                <SpecialEventBadge hours={day.hours} />
              </div>

              {day.isApprovedTimeOff && (
                <span
                  className="tag tag-status-approved my-schedule-status-tag"
                  data-testid={`my-schedule-timeoff-${day.date}`}
                >
                  Approved time off
                </span>
              )}

              {day.unavailability.map((entry) => (
                <span
                  key={entry.id}
                  className="tag tag-status-approved my-schedule-status-tag"
                  data-testid={`my-schedule-unavailability-${day.date}-${entry.id}`}
                >
                  {isFullDayUnavailability(entry)
                    ? 'Unavailable all day'
                    : `Unavailable ${entry.startTime}–${entry.endTime}`}
                </span>
              ))}

              {isOff && (
                <p className="my-schedule-off" data-testid={`my-schedule-off-${day.date}`}>
                  Off — no shift scheduled
                </p>
              )}

              {day.shifts.map((shift) => {
                const resolvedStartTime = resolveShiftTimeFromHours(
                  shift.startAnchor,
                  shift.startTime,
                  day.hours,
                );
                const resolvedEndTime = resolveShiftTimeFromHours(
                  shift.endAnchor,
                  shift.endTime,
                  day.hours,
                );

                return (
                  <div className="my-schedule-shift" key={shift.id}>
                    <span className="my-schedule-shift-department">
                      {DEPARTMENT_LABELS[shift.department]}
                    </span>
                    <ShiftCard
                      shift={shift}
                      color={
                        (shift.templateId && templatesById.get(shift.templateId)?.color) ||
                        DEFAULT_SHIFT_COLOR
                      }
                      isSalaried={currentEmployee?.isSalaried ?? false}
                      preferenceMatch={
                        resolvedStartTime && resolvedEndTime
                          ? matchPreference(
                              resolvedStartTime,
                              resolvedEndTime,
                              getDayOfWeek(day.date),
                              ownPreferences,
                            )
                          : 'none'
                      }
                      resolvedStartTime={resolvedStartTime}
                      resolvedEndTime={resolvedEndTime}
                      onClick={() => {}}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
