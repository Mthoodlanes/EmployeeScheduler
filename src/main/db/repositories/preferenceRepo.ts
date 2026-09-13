import { getDb } from '../connection';
import type { EmployeePreference } from '../../../shared/types/domain';

interface EmployeePreferenceRow {
  id: number;
  employee_id: number;
  day_of_week: number;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function toEmployeePreference(row: EmployeePreferenceRow): EmployeePreference {
  return {
    id: row.id,
    employeeId: row.employee_id,
    dayOfWeek: row.day_of_week,
    preferredStartTime: row.preferred_start_time,
    preferredEndTime: row.preferred_end_time,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreatePreferenceInput {
  employeeId: number;
  dayOfWeek: number;
  preferredStartTime: string;
  preferredEndTime: string;
  note?: string | null;
}

export interface UpdatePreferenceInput {
  id: number;
  dayOfWeek: number;
  preferredStartTime: string;
  preferredEndTime: string;
  note?: string | null;
}

export function getById(id: number): EmployeePreference | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM employee_preferences WHERE id = ?').get(id) as
    EmployeePreferenceRow | undefined;
  return row ? toEmployeePreference(row) : undefined;
}

/** Lists every preference window for one employee, an employee may have several (multiple days, or multiple windows on one day). */
export function listByEmployee(employeeId: number): EmployeePreference[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM employee_preferences WHERE employee_id = ? ORDER BY day_of_week, preferred_start_time',
    )
    .all(employeeId) as EmployeePreferenceRow[];
  return rows.map(toEmployeePreference);
}

/** Lists every preference window across every employee — used by the schedule grid's soft indicator. */
export function listAll(): EmployeePreference[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM employee_preferences ORDER BY employee_id, day_of_week, preferred_start_time',
    )
    .all() as EmployeePreferenceRow[];
  return rows.map(toEmployeePreference);
}

export function create(input: CreatePreferenceInput): EmployeePreference {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO employee_preferences (employee_id, day_of_week, preferred_start_time, preferred_end_time, note)
       VALUES (@employeeId, @dayOfWeek, @preferredStartTime, @preferredEndTime, @note)`,
    )
    .run({
      employeeId: input.employeeId,
      dayOfWeek: input.dayOfWeek,
      preferredStartTime: input.preferredStartTime,
      preferredEndTime: input.preferredEndTime,
      note: input.note ?? null,
    });

  const created = getById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error('Failed to load employee preference immediately after creation');
  }
  return created;
}

export function update(input: UpdatePreferenceInput): EmployeePreference {
  const db = getDb();
  db.prepare(
    `UPDATE employee_preferences
     SET day_of_week = ?, preferred_start_time = ?, preferred_end_time = ?, note = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ).run(
    input.dayOfWeek,
    input.preferredStartTime,
    input.preferredEndTime,
    input.note ?? null,
    input.id,
  );

  const updated = getById(input.id);
  if (!updated) {
    throw new Error(`Employee preference ${input.id} not found after update`);
  }
  return updated;
}

export function remove(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM employee_preferences WHERE id = ?').run(id);
}
