import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ScheduledShift, ShiftTemplate } from '@shared/types/domain';
import type { EmployeeWithDepartments } from '@shared/types/ipc';
import type { PreferenceMatchResult } from '@shared/logic/preferenceMatch';
import type { ResolvedHours } from '@shared/logic/hoursResolution';
import { resolveShiftTimeFromHours } from '@shared/logic/hoursResolution';
import { EmptyState } from '../EmptyState';
import { IconGripVertical, IconUsers } from '../icons';
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
  /**
   * Fired after a manager drags one row above/below another WITHIN this
   * department tab. `newDepartmentOrderIds` is just this tab's subset in its
   * new relative order — the caller (`ScheduleBoardPage`) is responsible for
   * merging that back into the full global order (see
   * `@shared/logic/employeeOrder`'s `mergeReorderedSubset`) before persisting
   * it, since this component only ever sees one department's employees.
   */
  onReorderDepartment: (newDepartmentOrderIds: number[]) => void;
}

interface CellPosition {
  row: number;
  col: number;
}

interface SortableEmployeeRowProps {
  employee: EmployeeWithDepartments;
  rowIndex: number;
  days: DayColumn[];
  shifts: ScheduledShift[];
  templatesById: Map<number, ShiftTemplate>;
  isDateBlocked: (employeeId: number, date: string) => boolean;
  getPreferenceMatch: ScheduleGridProps['getPreferenceMatch'];
  clampedActive: CellPosition;
  onAssign: (employeeId: number, date: string) => void;
  onEditShift: (shift: ScheduledShift) => void;
  onCellFocus: (row: number, col: number) => void;
  onCellKeyDown: (
    event: KeyboardEvent<HTMLDivElement>,
    row: number,
    col: number,
    employeeId: number,
    date: string,
    cellShifts: ScheduledShift[],
  ) => void;
}

/**
 * One employee's row, draggable via a small grip handle rather than the
 * whole row so clicking a day cell to open its assign/edit dialog keeps
 * working exactly as before. `useSortable` supplies both pointer- and
 * keyboard-driven reordering (Space to pick up, arrow keys to move, Space to
 * drop, Escape to cancel) plus its ARIA attributes out of the box — the
 * handle is a distinct focusable element, entirely separate from the grid's
 * own roving-tabindex arrow-key navigation across the day cells below, so
 * the two keyboard schemes never conflict.
 */
function SortableEmployeeRow({
  employee,
  rowIndex,
  days,
  shifts,
  templatesById,
  isDateBlocked,
  getPreferenceMatch,
  clampedActive,
  onAssign,
  onEditShift,
  onCellFocus,
  onCellKeyDown,
}: SortableEmployeeRowProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: employee.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div className="schedule-grid-row" role="row" ref={setNodeRef} style={style}>
      <div className="schedule-grid-employee-cell" role="rowheader">
        {/* dnd-kit's `attributes`/`listeners` are a dynamic, version-owned set of
            tabIndex, aria attributes, and pointer/keyboard event props (role,
            aria-roledescription, aria-describedby, onPointerDown, onKeyDown, etc.)
            that hand-listing would silently drift out of sync with — spreading is
            the supported pattern for a `useSortable` drag handle. */}
        <button
          type="button"
          className="schedule-grid-drag-handle"
          aria-label={`Reorder ${employee.name}`}
          data-testid={`employee-drag-handle-${employee.id}`}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...attributes}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...listeners}
        >
          <IconGripVertical />
        </button>
        <span className="schedule-grid-employee-name">{employee.name}</span>
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
            onFocus={() => onCellFocus(rowIndex, colIndex)}
            onKeyDown={(event) => onCellKeyDown(event, rowIndex, colIndex, employee.id, day.date, cellShifts)}
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
                      ? getPreferenceMatch(employee.id, day.date, resolvedStartTime, resolvedEndTime)
                      : 'none'
                  }
                  resolvedStartTime={resolvedStartTime}
                  resolvedEndTime={resolvedEndTime}
                  templateName={
                    (shift.templateId && templatesById.get(shift.templateId)?.name) || null
                  }
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
              {cellShifts.length === 0 ? `+ Assign${blocked ? ' anyway' : ''}` : '+ Add another'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Card-based weekly schedule grid, laid out with CSS grid rather than an
 * HTML table so each employee/day intersection reads as a comfortable card
 * cell. Implements the WAI-ARIA grid keyboard pattern with a roving
 * tabindex: arrow keys move focus between cells, Enter/Space activates the
 * focused cell's primary action (open the first shift for editing, or open
 * the assign dialog when the cell is empty). Employee rows are additionally
 * draggable (via each row's grip handle) to persistently reorder the
 * Schedule Board — see `onReorderDepartment`.
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
  onReorderDepartment,
}: ScheduleGridProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeCell, setActiveCell] = useState<CellPosition>({ row: 0, col: 0 });
  // PointerSensor covers both mouse and touch (Pointer Events), unlike the
  // native HTML5 Drag and Drop API, which has no touch support at all — this
  // app is used on phones (Milestone 22). A small activation distance avoids
  // hijacking an ordinary tap on the grip.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = employees.map((employee) => employee.id);
    const oldIndex = ids.indexOf(active.id as number);
    const newIndex = ids.indexOf(over.id as number);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderDepartment(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <div className="schedule-grid-wrapper">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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

          <SortableContext
            items={employees.map((employee) => employee.id)}
            strategy={verticalListSortingStrategy}
          >
            {employees.map((employee, rowIndex) => (
              <SortableEmployeeRow
                key={employee.id}
                employee={employee}
                rowIndex={rowIndex}
                days={days}
                shifts={shifts}
                templatesById={templatesById}
                isDateBlocked={isDateBlocked}
                getPreferenceMatch={getPreferenceMatch}
                clampedActive={clampedActive}
                onAssign={onAssign}
                onEditShift={onEditShift}
                onCellFocus={(row, col) => setActiveCell({ row, col })}
                onCellKeyDown={handleCellKeyDown}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  );
}
