import { getDb } from '../connection';
import type { EmployeeUnavailability, UnavailabilityStatus } from '../../../shared/types/domain';

interface EmployeeUnavailabilityRow {
  id: number;
  employee_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  reason: string | null;
  status: UnavailabilityStatus;
  requested_by: number;
  decided_by: number | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

function toEmployeeUnavailability(row: EmployeeUnavailabilityRow): EmployeeUnavailability {
  return {
    id: row.id,
    employeeId: row.employee_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
    status: row.status,
    requestedBy: row.requested_by,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateUnavailabilityInput {
  employeeId: number;
  requestedBy: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  reason?: string | null;
}

export interface UpdateUnavailabilityStatusInput {
  id: number;
  status: UnavailabilityStatus;
  decidedBy: number;
  decisionNote?: string | null;
}

export function getById(id: number): EmployeeUnavailability | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM employee_unavailability WHERE id = ?').get(id) as
    EmployeeUnavailabilityRow | undefined;
  return row ? toEmployeeUnavailability(row) : undefined;
}

/** Lists every request for one employee, most recently created first. */
export function listByEmployee(employeeId: number): EmployeeUnavailability[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM employee_unavailability WHERE employee_id = ? ORDER BY day_of_week, id DESC',
    )
    .all(employeeId) as EmployeeUnavailabilityRow[];
  return rows.map(toEmployeeUnavailability);
}

/** Lists every request across all employees, pending requests first — used by the manager queue. */
export function listAll(): EmployeeUnavailability[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM employee_unavailability
       ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, day_of_week`,
    )
    .all() as EmployeeUnavailabilityRow[];
  return rows.map(toEmployeeUnavailability);
}

/**
 * Every approved entry across all employees — used by the schedule grid to
 * cross-reference by employee + day-of-week. Not manager-restricted: any
 * logged-in user reading the schedule can see approved unavailability.
 */
export function listApproved(): EmployeeUnavailability[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM employee_unavailability WHERE status = 'approved' ORDER BY day_of_week, start_time`,
    )
    .all() as EmployeeUnavailabilityRow[];
  return rows.map(toEmployeeUnavailability);
}

export function create(input: CreateUnavailabilityInput): EmployeeUnavailability {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO employee_unavailability
         (employee_id, requested_by, day_of_week, start_time, end_time, reason)
       VALUES (@employeeId, @requestedBy, @dayOfWeek, @startTime, @endTime, @reason)`,
    )
    .run({
      employeeId: input.employeeId,
      requestedBy: input.requestedBy,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      reason: input.reason ?? null,
    });

  const created = getById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error('Failed to load unavailability request immediately after creation');
  }
  return created;
}

/** Records a manager's decision: sets status, decided_by, decision_note and stamps decided_at. */
export function updateStatus(input: UpdateUnavailabilityStatusInput): EmployeeUnavailability {
  const db = getDb();
  db.prepare(
    `UPDATE employee_unavailability
     SET status = ?, decided_by = ?, decision_note = ?,
         decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ).run(input.status, input.decidedBy, input.decisionNote ?? null, input.id);

  const updated = getById(input.id);
  if (!updated) {
    throw new Error(`Unavailability request ${input.id} not found after update`);
  }
  return updated;
}
