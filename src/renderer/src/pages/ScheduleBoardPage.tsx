import { useMemo, useState } from 'react';
import { DEPARTMENTS } from '@shared/types/domain';
import type {
  Department,
  EmployeeUnavailability,
  ScheduledShift,
  ShiftTemplate,
} from '@shared/types/domain';
import {
  formatDayLabel,
  formatWeekLabel,
  getDayOfWeek,
  getTodayIso,
  getWeekDates,
  getWeekStart,
  shiftWeek,
} from '@shared/logic/weekRange';
import { matchPreference } from '@shared/logic/preferenceMatch';
import type { PreferenceMatchResult } from '@shared/logic/preferenceMatch';
import { resolveHoursForDate, resolveShiftTimeFromHours } from '@shared/logic/hoursResolution';
import type { ResolvedHours } from '@shared/logic/hoursResolution';
import { findUnavailabilityConflicts, findUnavailabilityForDay } from '@shared/logic/unavailabilityConflict';
import { mergeReorderedSubset } from '@shared/logic/employeeOrder';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DepartmentTabs } from '../components/DepartmentTabs';
import { IconPrinter } from '../components/icons';
import { OverlapBanner } from '../components/OverlapBanner';
import { PrintSchedule } from '../components/PrintSchedule/PrintSchedule';
import type { CustomShiftInput } from '../components/ScheduleGrid/AssignShiftDialog';
import { AssignShiftDialog } from '../components/ScheduleGrid/AssignShiftDialog';
import { EditShiftDialog } from '../components/ScheduleGrid/EditShiftDialog';
import { ScheduleGrid } from '../components/ScheduleGrid/Grid';
import { HoursSummary } from '../components/ScheduleGrid/HoursSummary';
import { useEmployeePreferences } from '../hooks/useEmployeePreferences';
import { useEmployees, useReorderEmployees } from '../hooks/useEmployees';
import {
  useAssignCustomShift,
  useAssignShiftTemplate,
  useCarryOverWeek,
  useOverrideShift,
  useRemoveShift,
  useScheduleWeek,
} from '../hooks/useSchedule';
import { useShiftTemplates } from '../hooks/useShiftTemplates';
import { useSpecialEvents } from '../hooks/useSpecialEvents';
import { useStoreHours } from '../hooks/useStoreHours';
import { useApprovedTimeOffForRange } from '../hooks/useTimeOff';
import { useApprovedUnavailability } from '../hooks/useUnavailability';
import { useWeekOverlaps } from '../hooks/useWeekOverlaps';

const CLOSED_HOURS: ResolvedHours = {
  openTime: null,
  closeTime: null,
  isClosed: true,
  isOverride: false,
};

/** A manager can build the schedule at most this many weeks ahead of the current week. */
const MAX_WEEKS_AHEAD = 8;

interface AssignTarget {
  employeeId: number;
  date: string;
}

/** A template or custom assignment that overlaps approved unavailability, held pending the manager's explicit confirm. */
type PendingUnavailabilityAssignment =
  | { employeeId: number; date: string; kind: 'template'; templateId: number }
  | { employeeId: number; date: string; kind: 'custom'; input: CustomShiftInput };

export function ScheduleBoardPage(): React.JSX.Element {
  const [department, setDepartment] = useState<Department>(DEPARTMENTS[0]);
  const [weekStart, setWeekStart] = useState<string>(() => getWeekStart(getTodayIso()));
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [editTarget, setEditTarget] = useState<ScheduledShift | null>(null);
  const [timeOffOverrideTarget, setTimeOffOverrideTarget] = useState<AssignTarget | null>(null);
  const [unavailabilityOverride, setUnavailabilityOverride] =
    useState<PendingUnavailabilityAssignment | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [carryOverEmployeeId, setCarryOverEmployeeId] = useState<string>('');
  const [carryOverMessage, setCarryOverMessage] = useState<
    { kind: 'success' | 'error'; text: string } | null
  >(null);

  const { data: employees } = useEmployees();
  const { data: templates } = useShiftTemplates();
  const { data: shifts } = useScheduleWeek(department, weekStart);
  const { data: preferences } = useEmployeePreferences();
  const { data: storeHours } = useStoreHours();
  const { data: specialEvents } = useSpecialEvents();
  const { data: approvedUnavailability } = useApprovedUnavailability();
  const { overlaps } = useWeekOverlaps(weekStart);

  const assignMutation = useAssignShiftTemplate(department, weekStart);
  const assignCustomMutation = useAssignCustomShift(department, weekStart);
  const overrideMutation = useOverrideShift(department, weekStart);
  const removeMutation = useRemoveShift(department, weekStart);
  const reorderEmployeesMutation = useReorderEmployees();
  const carryOverMutation = useCarryOverWeek(department, weekStart);

  const maxWeekStart = useMemo(() => shiftWeek(getWeekStart(getTodayIso()), MAX_WEEKS_AHEAD), []);
  const isAtMaxWeek = weekStart >= maxWeekStart;
  const lastWeekStart = useMemo(() => shiftWeek(weekStart, -1), [weekStart]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const days = useMemo(
    () =>
      weekDates.map((date) => ({
        date,
        label: formatDayLabel(date),
        hours: resolveHoursForDate(date, storeHours ?? [], specialEvents ?? []),
      })),
    [weekDates, storeHours, specialEvents],
  );

  const { data: approvedTimeOff } = useApprovedTimeOffForRange(
    weekDates[0],
    weekDates[weekDates.length - 1],
  );

  const isDateBlocked = (employeeId: number, date: string): boolean =>
    (approvedTimeOff ?? []).some(
      (request) =>
        request.employeeId === employeeId && date >= request.startDate && date <= request.endDate,
    );

  const getEmployeeUnavailability = (employeeId: number): EmployeeUnavailability[] =>
    (approvedUnavailability ?? []).filter((entry) => entry.employeeId === employeeId);

  const getPreferenceMatch = (
    employeeId: number,
    date: string,
    startTime: string,
    endTime: string,
  ): PreferenceMatchResult => {
    const employeePreferences = (preferences ?? []).filter(
      (pref) => pref.employeeId === employeeId,
    );
    return matchPreference(startTime, endTime, getDayOfWeek(date), employeePreferences);
  };

  const departmentEmployees = useMemo(
    () =>
      (employees ?? []).filter(
        (employee) => employee.isActive && employee.departments.includes(department),
      ),
    [employees, department],
  );

  const departmentActiveTemplates = useMemo(
    () =>
      (templates ?? []).filter(
        (template) =>
          (template.department === department || template.department === null) && template.isActive,
      ),
    [templates, department],
  );

  /** The resolved hours for `date`, falling back to "closed/unknown" if `date` isn't in the current week (shouldn't normally happen). */
  const hoursForDate = (date: string): ResolvedHours =>
    days.find((day) => day.date === date)?.hours ?? CLOSED_HOURS;

  const getResolvedShiftTimes = (
    shift: ScheduledShift,
  ): { start: string | null; end: string | null } => {
    const hours = hoursForDate(shift.shiftDate);
    return {
      start: resolveShiftTimeFromHours(shift.startAnchor, shift.startTime, hours),
      end: resolveShiftTimeFromHours(shift.endAnchor, shift.endTime, hours),
    };
  };

  const templatesById = useMemo(() => {
    const map = new Map<number, ShiftTemplate>();
    (templates ?? []).forEach((template) => map.set(template.id, template));
    return map;
  }, [templates]);

  const closeDialogs = (): void => {
    setAssignTarget(null);
    setEditTarget(null);
    setTimeOffOverrideTarget(null);
    setUnavailabilityOverride(null);
    setDialogError(null);
  };

  const handleRequestAssign = (employeeId: number, date: string): void => {
    setDialogError(null);
    if (isDateBlocked(employeeId, date)) {
      // Manager is scheduling over an employee's approved time off — warn
      // and require an explicit confirm before opening the template picker.
      setTimeOffOverrideTarget({ employeeId, date });
    } else {
      setAssignTarget({ employeeId, date });
    }
  };

  /**
   * Unlike time off (a whole-day block checked before the dialog even
   * opens), unavailability is a time-window constraint — we can't know
   * whether a shift actually conflicts until the manager has picked a
   * template or entered a custom time. Returns the conflicting entries, if
   * any, for the resolved `[start, end)` on `date`.
   */
  const findConflictingUnavailability = (
    employeeId: number,
    date: string,
    start: string | null,
    end: string | null,
  ): EmployeeUnavailability[] => {
    if (!start || !end) return [];
    return findUnavailabilityConflicts(
      getDayOfWeek(date),
      start,
      end,
      getEmployeeUnavailability(employeeId),
    );
  };

  const performAssign = async (employeeId: number, date: string, templateId: number): Promise<void> => {
    setDialogError(null);
    try {
      await assignMutation.mutateAsync({
        employeeId,
        department,
        shiftDate: date,
        templateId,
      });
      setAssignTarget(null);
      setUnavailabilityOverride(null);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Could not assign shift');
    }
  };

  const performAssignCustom = async (
    employeeId: number,
    date: string,
    input: CustomShiftInput,
  ): Promise<void> => {
    setDialogError(null);
    try {
      await assignCustomMutation.mutateAsync({
        employeeId,
        department,
        shiftDate: date,
        ...input,
      });
      setAssignTarget(null);
      setUnavailabilityOverride(null);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Could not assign custom shift');
    }
  };

  const handleAssign = async (templateId: number): Promise<void> => {
    if (!assignTarget) return;
    const template = templatesById.get(templateId);
    const hours = hoursForDate(assignTarget.date);
    const resolvedStart = template
      ? resolveShiftTimeFromHours(template.startAnchor, template.startTime, hours)
      : null;
    const resolvedEnd = template
      ? resolveShiftTimeFromHours(template.endAnchor, template.endTime, hours)
      : null;
    const conflicts = findConflictingUnavailability(
      assignTarget.employeeId,
      assignTarget.date,
      resolvedStart,
      resolvedEnd,
    );
    if (conflicts.length > 0) {
      setUnavailabilityOverride({
        employeeId: assignTarget.employeeId,
        date: assignTarget.date,
        kind: 'template',
        templateId,
      });
      return;
    }
    await performAssign(assignTarget.employeeId, assignTarget.date, templateId);
  };

  const handleAssignCustom = async (input: CustomShiftInput): Promise<void> => {
    if (!assignTarget) return;
    const resolvedStart = input.startAnchor === 'fixed' ? input.startTime : null;
    const resolvedEnd = input.endAnchor === 'fixed' ? input.endTime : null;
    const conflicts = findConflictingUnavailability(
      assignTarget.employeeId,
      assignTarget.date,
      resolvedStart,
      resolvedEnd,
    );
    if (conflicts.length > 0) {
      setUnavailabilityOverride({
        employeeId: assignTarget.employeeId,
        date: assignTarget.date,
        kind: 'custom',
        input,
      });
      return;
    }
    await performAssignCustom(assignTarget.employeeId, assignTarget.date, input);
  };

  const handleUnavailabilityConfirm = async (): Promise<void> => {
    if (!unavailabilityOverride) return;
    if (unavailabilityOverride.kind === 'template') {
      await performAssign(
        unavailabilityOverride.employeeId,
        unavailabilityOverride.date,
        unavailabilityOverride.templateId,
      );
    } else {
      await performAssignCustom(
        unavailabilityOverride.employeeId,
        unavailabilityOverride.date,
        unavailabilityOverride.input,
      );
    }
  };

  const handleSaveOverride = async (startTime: string, endTime: string): Promise<void> => {
    if (!editTarget) return;
    setDialogError(null);
    try {
      await overrideMutation.mutateAsync({ id: editTarget.id, startTime, endTime });
      setEditTarget(null);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Could not update shift');
    }
  };

  const handleRemove = async (): Promise<void> => {
    if (!editTarget) return;
    setDialogError(null);
    try {
      await removeMutation.mutateAsync(editTarget.id);
      setEditTarget(null);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Could not remove shift');
    }
  };

  /**
   * `newDepartmentOrderIds` is only the CURRENT tab's subset (the Schedule
   * Board shows one department at a time) in its new post-drag order. Merge
   * it back into the full global order — every employee outside this
   * department keeps their exact position — before persisting, per the
   * feature's merge rule (see `mergeReorderedSubset`).
   */
  const handleReorderDepartment = (newDepartmentOrderIds: number[]): void => {
    const fullOrderIds = (employees ?? []).map((employee) => employee.id);
    const mergedOrderIds = mergeReorderedSubset(fullOrderIds, newDepartmentOrderIds);
    reorderEmployeesMutation.mutate({ orderedIds: mergedOrderIds });
  };

  const handleCarryOverEmployee = async (): Promise<void> => {
    if (!carryOverEmployeeId) return;
    const employee = departmentEmployees.find(
      (candidate) => String(candidate.id) === carryOverEmployeeId,
    );
    setCarryOverMessage(null);
    try {
      const created = await carryOverMutation.mutateAsync({
        sourceWeekStart: lastWeekStart,
        employeeId: Number(carryOverEmployeeId),
      });
      setCarryOverMessage({
        kind: 'success',
        text:
          created.length > 0
            ? `Copied ${created.length} shift${created.length === 1 ? '' : 's'} from last week for ${employee?.name ?? 'this employee'}.`
            : `${employee?.name ?? 'This employee'} had no shifts last week to copy, or this week's days already had shifts.`,
      });
    } catch (err) {
      setCarryOverMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not carry over last week',
      });
    }
  };

  const handleCarryOverAll = async (): Promise<void> => {
    setCarryOverMessage(null);
    try {
      const created = await carryOverMutation.mutateAsync({ sourceWeekStart: lastWeekStart });
      setCarryOverMessage({
        kind: 'success',
        text:
          created.length > 0
            ? `Copied ${created.length} shift${created.length === 1 ? '' : 's'} from last week.`
            : 'No shifts from last week to copy, or this week already had shifts on those days.',
      });
    } catch (err) {
      setCarryOverMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not carry over last week',
      });
    }
  };

  const assignTargetEmployee = assignTarget
    ? departmentEmployees.find((employee) => employee.id === assignTarget.employeeId)
    : undefined;
  const editTargetEmployee = editTarget
    ? departmentEmployees.find((employee) => employee.id === editTarget.employeeId)
    : undefined;
  const editTargetTemplateName = editTarget?.templateId
    ? (templatesById.get(editTarget.templateId)?.name ?? null)
    : null;
  const timeOffOverrideEmployee = timeOffOverrideTarget
    ? departmentEmployees.find((employee) => employee.id === timeOffOverrideTarget.employeeId)
    : undefined;
  const unavailabilityOverrideEmployee = unavailabilityOverride
    ? departmentEmployees.find((employee) => employee.id === unavailabilityOverride.employeeId)
    : undefined;
  const assignTargetUnavailability = assignTarget
    ? findUnavailabilityForDay(
        getDayOfWeek(assignTarget.date),
        getEmployeeUnavailability(assignTarget.employeeId),
      )
    : [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Schedule Board</h1>
        <button
          type="button"
          className="btn"
          onClick={() => window.print()}
          data-testid="print-schedule-button"
          title="For best results, choose Landscape orientation in the print dialog"
        >
          <IconPrinter /> Print Schedule
        </button>
      </div>

      <OverlapBanner warnings={overlaps} />

      <DepartmentTabs
        value={department}
        onChange={(nextDepartment) => {
          setDepartment(nextDepartment);
          setCarryOverEmployeeId('');
          setCarryOverMessage(null);
        }}
      />

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
          disabled={isAtMaxWeek}
          title={isAtMaxWeek ? `You can schedule at most ${MAX_WEEKS_AHEAD} weeks ahead` : undefined}
          onClick={() => setWeekStart((prev) => shiftWeek(prev, 1))}
        >
          Next week →
        </button>

        <div className="week-nav-carryover">
          <label className="week-nav-carryover-label" htmlFor="carry-over-employee">
            Carry over last week:
            <select
              id="carry-over-employee"
              className="week-nav-carryover-select"
              value={carryOverEmployeeId}
              onChange={(event) => setCarryOverEmployeeId(event.target.value)}
            >
              <option value="">Select employee…</option>
              {departmentEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            data-testid="carry-over-employee-button"
            disabled={!carryOverEmployeeId || carryOverMutation.isPending}
            onClick={handleCarryOverEmployee}
          >
            Carry over
          </button>
        </div>
        <button
          type="button"
          className="btn week-nav-carryover-all-btn"
          data-testid="carry-over-all-button"
          disabled={carryOverMutation.isPending || departmentEmployees.length === 0}
          onClick={handleCarryOverAll}
        >
          Carry over all employees
        </button>
      </div>

      {carryOverMessage && (
        <div
          role={carryOverMessage.kind === 'error' ? 'alert' : 'status'}
          className={carryOverMessage.kind === 'error' ? 'form-error' : 'form-success'}
          data-testid="carry-over-message"
        >
          {carryOverMessage.text}
        </div>
      )}

      <ScheduleGrid
        employees={departmentEmployees}
        days={days}
        shifts={shifts ?? []}
        templatesById={templatesById}
        isDateBlocked={isDateBlocked}
        getPreferenceMatch={getPreferenceMatch}
        onAssign={handleRequestAssign}
        onEditShift={(shift) => {
          setDialogError(null);
          setEditTarget(shift);
        }}
        onReorderDepartment={handleReorderDepartment}
      />

      <HoursSummary
        employees={departmentEmployees}
        shifts={shifts ?? []}
        getResolvedShiftTimes={getResolvedShiftTimes}
      />

      <PrintSchedule
        department={department}
        weekStart={weekStart}
        employees={departmentEmployees}
        days={days}
        shifts={shifts ?? []}
        templatesById={templatesById}
      />

      {timeOffOverrideTarget && timeOffOverrideEmployee && (
        <ConfirmDialog
          title="Employee has approved time off"
          message={`${timeOffOverrideEmployee.name} has approved time off on ${timeOffOverrideTarget.date}. Assign a shift anyway?`}
          confirmLabel="Assign anyway"
          onConfirm={() => {
            setAssignTarget(timeOffOverrideTarget);
            setTimeOffOverrideTarget(null);
          }}
          onCancel={() => setTimeOffOverrideTarget(null)}
        />
      )}

      {unavailabilityOverride && unavailabilityOverrideEmployee && (
        <ConfirmDialog
          title="Shift overlaps stated unavailability"
          message={`${unavailabilityOverrideEmployee.name} has approved unavailability that overlaps this shift on ${unavailabilityOverride.date}. Assign anyway?`}
          confirmLabel="Assign anyway"
          onConfirm={() => {
            handleUnavailabilityConfirm();
          }}
          onCancel={() => setUnavailabilityOverride(null)}
        />
      )}

      {assignTarget && assignTargetEmployee && (
        <AssignShiftDialog
          employeeName={assignTargetEmployee.name}
          date={assignTarget.date}
          templates={departmentActiveTemplates}
          unavailability={assignTargetUnavailability}
          isSaving={assignMutation.isPending || assignCustomMutation.isPending}
          error={dialogError}
          onAssign={handleAssign}
          onAssignCustom={handleAssignCustom}
          onClose={closeDialogs}
        />
      )}

      {editTarget && (
        <EditShiftDialog
          shift={editTarget}
          employeeName={editTargetEmployee?.name ?? 'Employee'}
          templateName={editTargetTemplateName}
          resolvedStartTime={getResolvedShiftTimes(editTarget).start}
          resolvedEndTime={getResolvedShiftTimes(editTarget).end}
          isSaving={overrideMutation.isPending || removeMutation.isPending}
          error={dialogError}
          onSaveOverride={handleSaveOverride}
          onRemove={handleRemove}
          onClose={closeDialogs}
        />
      )}
    </div>
  );
}
