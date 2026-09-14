import type { ScheduledShift } from '@shared/types/domain';
import type { EmployeeWithDepartments } from '@shared/types/ipc';
import { shiftDurationMinutes } from '@shared/logic/shiftMath';

/** Standard US weekly overtime threshold — a total at or past this gets flagged. */
const OVERTIME_HOURS_THRESHOLD = 40;

interface HoursSummaryProps {
  /** The currently selected department's active employees, already in Schedule Board row order. */
  employees: EmployeeWithDepartments[];
  /** The currently visible week's shifts for this same department. */
  shifts: ScheduledShift[];
  /** Resolves a shift's anchored/fixed start+end into actual clock times for its date — same resolver the grid itself uses, so hours here always match what's on screen. */
  getResolvedShiftTimes: (shift: ScheduledShift) => { start: string | null; end: string | null };
}

function formatHours(totalMinutes: number): string {
  const hours = Math.round((totalMinutes / 60) * 100) / 100;
  return `${hours}`;
}

/**
 * A quick per-employee "how many hours have I given this person this week"
 * read, scoped to the currently selected department tab (a manager builds
 * one department at a time, and this section's whole point is catching
 * overtime while doing that) — not a cross-department total. Salaried staff
 * are excluded entirely since their hours aren't hourly-tracked in the first
 * place (see `EmployeeWithDepartments.isSalaried`). Deliberately excluded
 * from the printed schedule (see the `.hours-summary` print rule in
 * styles.css) — the physical posting is just the shift grid.
 */
export function HoursSummary({
  employees,
  shifts,
  getResolvedShiftTimes,
}: HoursSummaryProps): React.JSX.Element | null {
  const hourlyEmployees = employees.filter((employee) => !employee.isSalaried);
  if (hourlyEmployees.length === 0) {
    return null;
  }

  const minutesByEmployeeId = new Map<number, number>();
  shifts.forEach((shift) => {
    const { start, end } = getResolvedShiftTimes(shift);
    if (start === null || end === null) {
      return;
    }
    const minutes = shiftDurationMinutes(start, end);
    minutesByEmployeeId.set(shift.employeeId, (minutesByEmployeeId.get(shift.employeeId) ?? 0) + minutes);
  });

  return (
    <div className="hours-summary card section" data-testid="hours-summary">
      <h2>Hours Summary</h2>
      <table className="data-table" data-testid="hours-summary-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Hours this week</th>
          </tr>
        </thead>
        <tbody>
          {hourlyEmployees.map((employee) => {
            const totalMinutes = minutesByEmployeeId.get(employee.id) ?? 0;
            const isOvertime = totalMinutes / 60 >= OVERTIME_HOURS_THRESHOLD;
            return (
              <tr key={employee.id} data-testid={`hours-summary-row-${employee.id}`}>
                <td>{employee.name}</td>
                <td>
                  <span
                    className={isOvertime ? 'hours-summary-total hours-summary-overtime' : 'hours-summary-total'}
                    data-testid={`hours-summary-total-${employee.id}`}
                  >
                    {formatHours(totalMinutes)}
                  </span>
                  {isOvertime && (
                    <span className="tag tag-status-denied hours-summary-overtime-tag">Overtime</span>
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
