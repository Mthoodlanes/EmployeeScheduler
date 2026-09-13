import { getDb } from '../connection';
import type { TimeOffRequest, TimeOffStatus } from '../../../shared/types/domain';

interface TimeOffRequestRow {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: TimeOffStatus;
  decided_by: number | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

function toTimeOffRequest(row: TimeOffRequestRow): TimeOffRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateTimeOffRequestInput {
  employeeId: number;
  startDate: string;
  endDate: string;
  reason?: string | null;
}

export interface UpdateTimeOffStatusInput {
  id: number;
  status: TimeOffStatus;
  decidedBy: number;
  decisionNote?: string | null;
}

export function getById(id: number): TimeOffRequest | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM time_off_requests WHERE id = ?').get(id) as
    TimeOffRequestRow | undefined;
  return row ? toTimeOffRequest(row) : undefined;
}

/** Lists every request for one employee, most recent start date first. */
export function listByEmployee(employeeId: number): TimeOffRequest[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM time_off_requests WHERE employee_id = ? ORDER BY start_date DESC, id DESC',
    )
    .all(employeeId) as TimeOffRequestRow[];
  return rows.map(toTimeOffRequest);
}

/** Lists every request across all employees, pending requests first — used by the manager queue. */
export function listAll(): TimeOffRequest[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM time_off_requests
       ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, start_date`,
    )
    .all() as TimeOffRequestRow[];
  return rows.map(toTimeOffRequest);
}

/** Lists approved requests whose date range overlaps [startDate, endDate] (both inclusive). */
export function listApprovedInDateRange(startDate: string, endDate: string): TimeOffRequest[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM time_off_requests
       WHERE status = 'approved' AND start_date <= ? AND end_date >= ?
       ORDER BY start_date`,
    )
    .all(endDate, startDate) as TimeOffRequestRow[];
  return rows.map(toTimeOffRequest);
}

export function create(input: CreateTimeOffRequestInput): TimeOffRequest {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO time_off_requests (employee_id, start_date, end_date, reason)
       VALUES (@employeeId, @startDate, @endDate, @reason)`,
    )
    .run({
      employeeId: input.employeeId,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason ?? null,
    });

  const created = getById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error('Failed to load time-off request immediately after creation');
  }
  return created;
}

/** Records a manager's decision: sets status, decided_by, decision_note and stamps decided_at. */
export function updateStatus(input: UpdateTimeOffStatusInput): TimeOffRequest {
  const db = getDb();
  db.prepare(
    `UPDATE time_off_requests
     SET status = ?, decided_by = ?, decision_note = ?,
         decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ).run(input.status, input.decidedBy, input.decisionNote ?? null, input.id);

  const updated = getById(input.id);
  if (!updated) {
    throw new Error(`Time-off request ${input.id} not found after update`);
  }
  return updated;
}
