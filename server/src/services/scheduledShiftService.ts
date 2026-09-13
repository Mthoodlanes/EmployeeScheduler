/**
 * Milestone 16: port of `src/main/services/scheduledShiftService.ts` onto
 * the new Drizzle `scheduledShiftRepo`/`shiftTemplateRepo` (Milestone 15),
 * RETROFITTED with a `RequestingActor` parameter — one of the 3 services
 * whose authorization checks originally lived only at the IPC-handler layer
 * (`src/main/ipc/scheduledShifts.ipc.ts`'s `requireLoggedIn()`/
 * `requireManager()`), moved in here the same way as `employeeService`/
 * `shiftTemplateService`.
 *
 * Original IPC-layer checks being moved in here (see
 * `src/main/ipc/scheduledShifts.ipc.ts`):
 *   - `scheduledShiftsListWeek`       -> requireLoggedIn() -> listWeek(actor, department, weekStart)
 *   - `scheduledShiftsAssignTemplate` -> requireManager()  -> assignTemplate(actor, input)
 *   - `scheduledShiftsAssignCustom`   -> requireManager()  -> assignCustomShift(actor, input)
 *   - `scheduledShiftsOverride`       -> requireManager()  -> overrideShift(actor, input)
 *   - `scheduledShiftsRemove`         -> requireManager()  -> removeShift(actor, id)
 *
 * `getWeekDates` comes from the new `server/src/logic/weekRange.js` port
 * (see that file's header for why it had to be duplicated rather than
 * imported from `src/shared`).
 */
import * as scheduledShiftRepo from '../db/repositories/scheduledShiftRepo.js';
import * as shiftTemplateRepo from '../db/repositories/shiftTemplateRepo.js';
import { getWeekDates } from '../logic/weekRange.js';
import { DepartmentMismatchError, ShiftTemplateNotFoundError } from './scheduledShiftErrors.js';
import type {
  Department,
  EndAnchor,
  RequestingActor,
  ScheduledShift,
  StartAnchor,
} from '../db/domain-types.js';

export type { RequestingActor };
export { DepartmentMismatchError, ShiftTemplateNotFoundError };

export class UnauthorizedScheduledShiftActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedScheduledShiftActionError';
  }
}

function assertManager(actor: RequestingActor): void {
  if (actor.role !== 'manager') {
    throw new UnauthorizedScheduledShiftActionError('Only managers can manage the schedule');
  }
}

export interface AssignTemplateInput {
  employeeId: number;
  department: Department;
  shiftDate: string;
  templateId: number;
}

export interface AssignCustomShiftInput {
  employeeId: number;
  department: Department;
  shiftDate: string;
  startAnchor: StartAnchor;
  startTime: string | null;
  endAnchor: EndAnchor;
  endTime: string | null;
  notes?: string | null;
}

export interface OverrideShiftInput {
  id: number;
  startTime: string;
  endTime: string;
  notes?: string | null;
}

function normalizeStart(anchor: StartAnchor, time: string | null): string | null {
  if (anchor !== 'fixed') {
    return null;
  }
  if (!time) {
    throw new Error('A start time is required unless the shift opens with the store');
  }
  return time;
}

function normalizeEnd(anchor: EndAnchor, time: string | null): string | null {
  if (anchor !== 'fixed') {
    return null;
  }
  if (!time) {
    throw new Error('An end time is required unless the shift closes with the store');
  }
  return time;
}

/**
 * Lists every scheduled shift for a department across the Monday-Sunday week
 * starting `weekStart`. Any logged-in user may read the schedule — `actor`
 * is still required (rather than dropped) to keep this function's
 * authorization signature uniform with the other 8 services.
 */
export async function listWeek(
  _actor: RequestingActor,
  department: Department,
  weekStart: string,
): Promise<ScheduledShift[]> {
  const weekDates = getWeekDates(weekStart);
  return scheduledShiftRepo.listByDepartmentAndDateRange(
    department,
    weekDates[0],
    weekDates[weekDates.length - 1],
  );
}

/**
 * Manager-only: assigns a shift template to an employee on a given date,
 * copying the template's start/end time (and anchors) onto a new
 * `scheduled_shifts` row. The row keeps a reference to the template
 * (`templateId`) so it can later be identified as "based on X" even if the
 * manager overrides its time. A shared template (`department === null`) may
 * be assigned from any of the three department tabs; a department-specific
 * template may only be assigned from its own tab.
 */
export async function assignTemplate(
  actor: RequestingActor,
  input: AssignTemplateInput,
): Promise<ScheduledShift> {
  assertManager(actor);
  const template = await shiftTemplateRepo.getById(input.templateId);
  if (!template) {
    throw new ShiftTemplateNotFoundError(input.templateId);
  }
  if (template.department !== null && template.department !== input.department) {
    throw new DepartmentMismatchError();
  }

  return scheduledShiftRepo.create({
    employeeId: input.employeeId,
    department: input.department,
    shiftDate: input.shiftDate,
    startTime: template.startTime,
    endTime: template.endTime,
    startAnchor: template.startAnchor,
    endAnchor: template.endAnchor,
    templateId: template.id,
    isOverride: false,
  });
}

/**
 * Manager-only: assigns a one-off custom time directly, with no saved shift
 * template involved (`templateId` stays `null`). Not treated as
 * `isOverride` — that flag means "diverged from an assigned template",
 * which doesn't apply to a from-scratch entry with no template to diverge
 * from. A manager can still pick 'open'/'close' anchors here exactly as on
 * a template.
 */
export async function assignCustomShift(
  actor: RequestingActor,
  input: AssignCustomShiftInput,
): Promise<ScheduledShift> {
  assertManager(actor);
  return scheduledShiftRepo.create({
    employeeId: input.employeeId,
    department: input.department,
    shiftDate: input.shiftDate,
    startTime: normalizeStart(input.startAnchor, input.startTime),
    endTime: normalizeEnd(input.endAnchor, input.endTime),
    startAnchor: input.startAnchor,
    endAnchor: input.endAnchor,
    templateId: null,
    isOverride: false,
    notes: input.notes ?? null,
  });
}

/** Manager-only: overrides an individual shift's start/end time, marking it `isOverride` while keeping `templateId`. */
export async function overrideShift(
  actor: RequestingActor,
  input: OverrideShiftInput,
): Promise<ScheduledShift> {
  assertManager(actor);
  return scheduledShiftRepo.updateOverride(input);
}

/** Manager-only: removes a scheduled shift. */
export async function removeShift(actor: RequestingActor, id: number): Promise<void> {
  assertManager(actor);
  await scheduledShiftRepo.remove(id);
}
