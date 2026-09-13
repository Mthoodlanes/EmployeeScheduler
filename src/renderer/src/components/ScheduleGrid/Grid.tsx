import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ScheduledShift, ShiftTemplate } from '@shared/types/domain';
import type { EmployeeWithDepartments } from '@shared/types/ipc';
import type { PreferenceMatchResult } from '@shared/logic/preferenceMatch';
import type { ResolvedHours } from '@shared/logic/hoursResolution';
import { resolveShiftTimeFromHours } from '@shared/logic/hoursResolution';
import { EmptyState } from '../EmptyState';
import { IconUsers } from '../icons';
import { SpecialEventBadge } from '../SpecialEventBadge';
import { ShiftCard } from './ShiftCard';

const DEFAULT_SHIFT_COLOR = '#94a3b8';

export interface DayColumn {
  date: string;
  label: string;
  /** The store's effective hours for this date (weekly default or special-event override). */
  hours: ResolvedHours;
}

interface ScheduleGridProps {
  employees: EmployeeWithDepartments[];
  days: DayColumn[];
  shifts: ScheduledShift[];
  templatesById: Map<number, ShiftTemplate>;
  /** True when the employee has approved time off covering that date. */
  isDateBlocked: (employeeId: number, date: string) => boolean;
  /** Soft, non-blocking preference match for one shift, per the employee's stated day-of-week preference. */
  getPreferenceMatch: (
    employeeId: number,
    date: string,
    startTime: string,
    endTime: string,
  ) => PreferenceMatchResult;
  onAssign: (employeeId: number, date: string) => void;
  onEditShift: (shift: ScheduledShift) => void;
}

interface CellPosition {
  row: number;
  col: number;
}

/**
 * Card-based weekly schedule grid, laid out with CSS grid rather than an
 * HTML table so each employee/day intersection reads as a comfortable card
 * cell. Implements the WAI-ARIA grid keyboard pattern with a roving
 * tabindex: arrow keys move focus between cells, Enter/Space activates the
 * focused cell's primary action (open the first shift for editing, or open
 * the assign dialog when the cell is empty).
 */
export function ScheduleGrid({
  employees,
  days,
  shifts,
  templatesById,
  isDateBlocked,
  getPreferenceMatch,
  onAssign,
  onEditShift,
}: ScheduleGridProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeCell, setActiveCell] = useState<CellPosition>({ row: 0, col: 0 });

  if (employees.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<IconUsers />}
          title="No employees are assigned to this department yet"
          body="Add departments to an employee from the Employees page to see them on this board."
        />
      </div>
    );
  }

  const rowCount = employees.length;
  const colCount = days.length;
  const clampedActive: CellPosition = {
    row: Math.min(activeCell.row, rowCount - 1),
    col: Math.min(activeCell.col, colCount - 1),
  };

  const focusCell = (row: number, col: number): void => {
    const target = containerRef.current?.querySelector<HTMLElement>(
      `[data-grid-row="${row}"][data-grid-col="${col}"]`,
    );
    target?.focus();
    setActiveCell({ row, col });
  };

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    row: number,
    col: number,
    employeeId: number,
    date: string,
    cellShifts: ScheduledShift[],
  ): void => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusCell(row, Math.min(col + 1, colCount - 1));
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusCell(row, Math.max(col - 1, 0));
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusCell(Math.min(row + 1, rowCount - 1), col);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusCell(Math.max(row - 1, 0), col);
        break;
      case 'Home':
        event.preventDefault();
        focusCell(row, 0);
        break;
      case 'End':
        event.preventDefault();
        focusCell(row, colCount - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (cellShifts.length > 0) {
          onEditShift(cellShifts[0]);
        } else {
          onAssign(employeeId, date);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="schedule-grid-wrapper">
      <div
        className="schedule-grid"
        role="grid"
        aria-label="Weekly schedule"
        ref={containerRef}
        style={{
          gridTemplateColumns: `minmax(170px, 200px) repeat(${colCount}, minmax(168px, 1fr))`,
        }}
      >
        <div className="schedule-grid-row" role="row">
          <div className="schedule-grid-corner" role="columnheader">
            Employee
          </div>
          {days.map((day) => (
            <div
              key={day.date}
              role="columnheader"
              className={
                day.hours.isClosed
                  ? 'schedule-grid-col-header schedule-grid-day-header-closed'
                  : 'schedule-grid-col-header'
              }
            >
              <div className="schedule-grid-day-header">
                <span className="schedule-grid-day-header-label">{day.label}</span>
                <SpecialEventBadge hours={day.hours} />
              </div>
            </div>
          ))}
        </div>

        {employees.map((employee, rowIndex) => (
          <div className="schedule-grid-row" role="row" key={employee.id}>
            <div className="schedule-grid-employee-cell" role="rowheader">
              {employee.name}
              {employee.isSalaried && <span className="tag tag-salaried">Salaried</span>}
            </div>
            {days.map((day, colIndex) => {
              const cellShifts = shifts.filter(
                (shift) => shift.employeeId === employee.id && shift.shiftDate === day.date,
              );
              const blocked = isDateBlocked(employee.id, day.date);
              const isTabbable = clampedActive.row === rowIndex && clampedActive.col === colIndex;
              const cellLabel = `${employee.name}, ${day.label}${blocked ? ', approved time off' : ''}${
                cellShifts.length > 0
                  ? `, ${cellShifts.length} shift${cellShifts.length > 1 ? 's' : ''}`
                  : ', empty'
              }`;

              return (
                <div
                  key={day.date}
                  role="gridcell"
                  aria-label={cellLabel}
                  tabIndex={isTabbable ? 0 : -1}
                  data-grid-row={rowIndex}
                  data-grid-col={colIndex}
                  className={
                    blocked ? 'schedule-grid-cell schedule-grid-cell-blocked' : 'schedule-grid-cell'
                  }
                  onFocus={() => setActiveCell({ row: rowIndex, col: colIndex })}
                  onKeyDown={(event) =>
                    handleCellKeyDown(event, rowIndex, colIndex, employee.id, day.date, cellShifts)
                  }
                >
                  {blocked && (
                    <span
                      className="tag tag-timeoff tag-timeoff-cell"
                      data-testid={`timeoff-blocked-${employee.id}-${day.date}`}
                    >
                      Time Off
                    </span>
                  )}
                  {cellShifts.map((shift) => {
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
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        color={
                          (shift.templateId && templatesById.get(shift.templateId)?.color) ||
                          DEFAULT_SHIFT_COLOR
                        }
                        isSalaried={employee.isSalaried}
                        preferenceMatch={
                          resolvedStartTime && resolvedEndTime
                            ? getPreferenceMatch(
                                employee.id,
                                day.date,
                                resolvedStartTime,
                                resolvedEndTime,
                              )
                            : 'none'
                        }
                        resolvedStartTime={resolvedStartTime}
                        resolvedEndTime={resolvedEndTime}
                        onClick={() => onEditShift(shift)}
                      />
                    );
                  })}
                  <button
                    type="button"
                    className="schedule-grid-add-cell"
                    tabIndex={-1}
                    data-testid={`schedule-cell-${employee.id}-${day.date}`}
                    onClick={() => onAssign(employee.id, day.date)}
                    aria-label={`Assign shift for ${employee.name} on ${day.date}`}
                  >
                    {cellShifts.length === 0
                      ? `+ Assign${blocked ? ' anyway' : ''}`
                      : '+ Add another'}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
