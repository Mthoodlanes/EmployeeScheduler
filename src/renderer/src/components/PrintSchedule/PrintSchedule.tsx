import { DEPARTMENT_LABELS } from '@shared/types/domain';
import type { Department, ScheduledShift } from '@shared/types/domain';
import type { EmployeeWithDepartments } from '@shared/types/ipc';
import { formatWeekLabel } from '@shared/logic/weekRange';
import { resolveShiftTimeFromHours } from '@shared/logic/hoursResolution';
import type { ResolvedHours } from '@shared/logic/hoursResolution';
import type { DayColumn } from '../ScheduleGrid/Grid';

interface PrintScheduleProps {
  department: Department;
  weekStart: string;
  employees: EmployeeWithDepartments[];
  days: DayColumn[];
  shifts: ScheduledShift[];
}

/** The day column header's effective store hours, as plain printable text (no color-only signal — see PrintSchedule.css). */
function formatDayHours(hours: ResolvedHours): string {
  if (hours.isClosed) {
    return hours.label ? `Closed — ${hours.label}` : 'Closed';
  }
  if (!hours.openTime || !hours.closeTime) {
    return 'Hours not set';
  }
  const range = `${hours.openTime}–${hours.closeTime}`;
  return hours.isOverride && hours.label ? `${range} (${hours.label})` : range;
}

/** Text labels for one shift — never color-only, since the printed page is grayscale. */
function shiftLabels(shift: ScheduledShift, isSalaried: boolean): string[] {
  const labels: string[] = [];
  if (isSalaried) {
    labels.push('Flexible');
  }
  if (shift.isOverride) {
    labels.push('Edited');
  } else if (shift.templateId === null) {
    labels.push('Custom');
  }
  return labels;
}

/**
 * Purpose-built, print-only table rendering of the currently viewed
 * department/week — a plain HTML table rather than the interactive
 * `ScheduleGrid` CSS-grid, since a physical break-room posting needs a
 * simple table layout, not an ARIA-grid keyboard-navigation pattern.
 * Always mounted in the DOM alongside the live `ScheduleGrid`, but hidden
 * on screen and shown only under `@media print` (see PrintSchedule.css and
 * the print rules in styles.css that hide the rest of the app's chrome), so
 * `window.print()` needs no separate render pass — it just prints whatever
 * `@media print` currently reveals.
 */
export function PrintSchedule({
  department,
  weekStart,
  employees,
  days,
  shifts,
}: PrintScheduleProps): React.JSX.Element {
  return (
    <div className="print-schedule">
      <div className="print-schedule-header">
        <h1 className="print-schedule-title">
          {DEPARTMENT_LABELS[department]} — Weekly Schedule
        </h1>
        <p className="print-schedule-subtitle">{formatWeekLabel(weekStart)}</p>
      </div>

      {employees.length === 0 ? (
        <p className="print-schedule-empty">No employees are assigned to this department.</p>
      ) : (
        <table className="print-schedule-table">
          <thead>
            <tr>
              <th className="print-schedule-employee-col">Employee</th>
              {days.map((day) => (
                <th key={day.date}>
                  <div className="print-day-label">{day.label}</div>
                  <div className="print-day-hours">{formatDayHours(day.hours)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td className="print-schedule-employee-col">
                  {employee.name}
                  {employee.isSalaried && <span> (Flexible)</span>}
                </td>
                {days.map((day) => {
                  const cellShifts = shifts.filter(
                    (shift) => shift.employeeId === employee.id && shift.shiftDate === day.date,
                  );
                  return (
                    <td key={day.date}>
                      {cellShifts.length === 0 && <span className="print-shift-empty">—</span>}
                      {cellShifts.map((shift) => {
                        const start = resolveShiftTimeFromHours(
                          shift.startAnchor,
                          shift.startTime,
                          day.hours,
                        );
                        const end = resolveShiftTimeFromHours(
                          shift.endAnchor,
                          shift.endTime,
                          day.hours,
                        );
                        const labels = shiftLabels(shift, employee.isSalaried);
                        return (
                          <div className="print-shift" key={shift.id}>
                            <div className="print-shift-time">
                              {start && end ? `${start}–${end}` : 'Time not set'}
                            </div>
                            {labels.length > 0 && (
                              <div className="print-shift-labels">{labels.join(' · ')}</div>
                            )}
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
