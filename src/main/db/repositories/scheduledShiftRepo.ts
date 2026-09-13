import { getDb } from '../connection';
import type {
  Department,
  EndAnchor,
  ScheduledShift,
  StartAnchor,
} from '../../../shared/types/domain';

interface ScheduledShiftRow {
  id: number;
  employee_id: number;
  department: Department;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  start_anchor: StartAnchor;
  end_anchor: EndAnchor;
  template_id: number | null;
  is_override: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toScheduledShift(row: ScheduledShiftRow): ScheduledShift {
  return {
    id: row.id,
    employeeId: row.employee_id,
    department: row.department,
    shiftDate: row.shift_date,
    startTime: row.start_time,
    endTime: row.end_time,
    startAnchor: row.start_anchor,
    endAnchor: row.end_anchor,
    templateId: row.template_id,
    isOverride: row.is_override === 1,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateScheduledShiftInput {
  employeeId: number;
  department: Department;
  shiftDate: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor?: StartAnchor;
  endAnchor?: EndAnchor;
  templateId: number | null;
  isOverride: boolean;
  notes?: string | null;
}

export interface UpdateScheduledShiftOverrideInput {
  id: number;
  startTime: string;
  endTime: string;
  notes?: string | null;
}

export function listByDepartmentAndDateRange(
  department: Department,
  startDate: string,
  endDate: string,
): ScheduledShift[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM scheduled_shifts
       WHERE department = ? AND shift_date BETWEEN ? AND ?
       ORDER BY shift_date, start_time`,
    )
    .all(department, startDate, endDate) as ScheduledShiftRow[];
  return rows.map(toScheduledShift);
}

export function getById(id: number): ScheduledShift | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM scheduled_shifts WHERE id = ?').get(id) as
    ScheduledShiftRow | undefined;
  return row ? toScheduledShift(row) : undefined;
}

export function create(input: CreateScheduledShiftInput): ScheduledShift {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO scheduled_shifts
         (employee_id, department, shift_date, start_time, end_time, start_anchor, end_anchor, template_id, is_override, notes)
       VALUES (@employeeId, @department, @shiftDate, @startTime, @endTime, @startAnchor, @endAnchor, @templateId, @isOverride, @notes)`,
    )
    .run({
      employeeId: input.employeeId,
      department: input.department,
      shiftDate: input.shiftDate,
      startTime: input.startTime,
      endTime: input.endTime,
      startAnchor: input.startAnchor ?? 'fixed',
      endAnchor: input.endAnchor ?? 'fixed',
      templateId: input.templateId,
      isOverride: input.isOverride ? 1 : 0,
      notes: input.notes ?? null,
    });

  const created = getById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error('Failed to load scheduled shift immediately after creation');
  }
  return created;
}

/**
 * Overrides an individual shift's start/end time with literal values,
 * marking it `isOverride`. Manager-supplied override times are always
 * literal clock times, so both anchors are forced back to `'fixed'` — this
 * is how an anchored ("2pm-Close") shift becomes a plain fixed-time shift
 * once a manager edits its time by hand.
 */
export function updateOverride(input: UpdateScheduledShiftOverrideInput): ScheduledShift {
  const db = getDb();
  db.prepare(
    `UPDATE scheduled_shifts
     SET start_time = ?, end_time = ?, start_anchor = 'fixed', end_anchor = 'fixed', is_override = 1, notes = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ).run(input.startTime, input.endTime, input.notes ?? null, input.id);

  const updated = getById(input.id);
  if (!updated) {
    throw new Error(`Scheduled shift ${input.id} not found after update`);
  }
  return updated;
}

export function remove(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM scheduled_shifts WHERE id = ?').run(id);
}
