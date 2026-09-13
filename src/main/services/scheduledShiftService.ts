import * as scheduledShiftRepo from '../db/repositories/scheduledShiftRepo';
import * as shiftTemplateRepo from '../db/repositories/shiftTemplateRepo';
import { getWeekDates } from '../../shared/logic/weekRange';
import type { Department, EndAnchor, ScheduledShift, StartAnchor } from '../../shared/types/domain';

export class ShiftTemplateNotFoundError extends Error {
  constructor(id: number) {
    super(`Shift template ${id} not found`);
    this.name = 'ShiftTemplateNotFoundError';
  }
}

export class DepartmentMismatchError extends Error {
  constructor() {
    super('That shift template does not belong to the requested department');
    this.name = 'DepartmentMismatchError';
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

/** Lists every scheduled shift for a department across the Monday-Sunday week starting `weekStart`. */
export function listWeek(department: Department, weekStart: string): ScheduledShift[] {
  const weekDates = getWeekDates(weekStart);
  return scheduledShiftRepo.listByDepartmentAndDateRange(
    department,
    weekDates[0],
    weekDates[weekDates.length - 1],
  );
}

/**
 * Assigns a shift template to an employee on a given date, copying the
 * template's start/end time (and anchors) onto a new `scheduled_shifts` row.
 * The row keeps a reference to the template (`templateId`) so it can later
 * be identified as "based on X" even if the manager overrides its time. A
 * shared template (`department === null`) may be assigned from any of the
 * three department tabs; a department-specific template may only be
 * assigned from its own tab.
 */
export function assignTemplate(input: AssignTemplateInput): ScheduledShift {
  const template = shiftTemplateRepo.getById(input.templateId);
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
 * Assigns a one-off custom time directly, with no saved shift template
 * involved (`templateId` stays `null`). Not treated as `isOverride` — that
 * flag means "diverged from an assigned template", which doesn't apply to a
 * from-scratch entry with no template to diverge from. A manager can still
 * pick 'open'/'close' anchors here exactly as on a template.
 */
export function assignCustomShift(input: AssignCustomShiftInput): ScheduledShift {
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

/** Overrides an individual shift's start/end time, marking it `isOverride` while keeping `templateId`. */
export function overrideShift(input: OverrideShiftInput): ScheduledShift {
  return scheduledShiftRepo.updateOverride(input);
}

export function removeShift(id: number): void {
  scheduledShiftRepo.remove(id);
}
