import { asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { employeeUnavailability } from '../schema.js';
import type { EmployeeUnavailability, UnavailabilityStatus } from '../domain-types.js';

type EmployeeUnavailabilityRow = typeof employeeUnavailability.$inferSelect;

function toEmployeeUnavailability(row: EmployeeUnavailabilityRow): EmployeeUnavailability {
  return {
    id: row.id,
    employeeId: row.employeeId,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    reason: row.reason,
    status: row.status,
    requestedBy: row.requestedBy,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

export async function getById(id: number): Promise<EmployeeUnavailability | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(employeeUnavailability)
    .where(eq(employeeUnavailability.id, id));
  return row ? toEmployeeUnavailability(row) : undefined;
}

/** Lists every request for one employee, most recently created first. */
export async function listByEmployee(employeeId: number): Promise<EmployeeUnavailability[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(employeeUnavailability)
    .where(eq(employeeUnavailability.employeeId, employeeId))
    .orderBy(asc(employeeUnavailability.dayOfWeek), desc(employeeUnavailability.id));
  return rows.map(toEmployeeUnavailability);
}

/** Lists every request across all employees, pending requests first — used by the manager queue. */
export async function listAll(): Promise<EmployeeUnavailability[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(employeeUnavailability)
    .orderBy(
      sql`case when ${employeeUnavailability.status} = 'pending' then 0 else 1 end`,
      asc(employeeUnavailability.dayOfWeek),
    );
  return rows.map(toEmployeeUnavailability);
}

/**
 * Every approved entry across all employees — used by the schedule grid to
 * cross-reference by employee + day-of-week. Not manager-restricted: any
 * logged-in user reading the schedule can see approved unavailability.
 */
export async function listApproved(): Promise<EmployeeUnavailability[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(employeeUnavailability)
    .where(eq(employeeUnavailability.status, 'approved'))
    .orderBy(asc(employeeUnavailability.dayOfWeek), asc(employeeUnavailability.startTime));
  return rows.map(toEmployeeUnavailability);
}

export async function create(input: CreateUnavailabilityInput): Promise<EmployeeUnavailability> {
  const db = getDb();
  const [inserted] = await db
    .insert(employeeUnavailability)
    .values({
      employeeId: input.employeeId,
      requestedBy: input.requestedBy,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      reason: input.reason ?? null,
    })
    .returning({ id: employeeUnavailability.id });

  const created = await getById(inserted.id);
  if (!created) {
    throw new Error('Failed to load unavailability request immediately after creation');
  }
  return created;
}

/** Records a manager's decision: sets status, decided_by, decision_note and stamps decided_at. */
export async function updateStatus(
  input: UpdateUnavailabilityStatusInput,
): Promise<EmployeeUnavailability> {
  const db = getDb();
  // See timeOffRepo.updateStatus: `decided_at` stays TEXT in the schema, so
  // it's stamped from JS (same ISO shape as the original `strftime` output)
  // rather than `sql`now()``, which Postgres would refuse to implicitly cast
  // from `timestamptz` into a `text` column.
  const decidedAt = new Date().toISOString();
  await db
    .update(employeeUnavailability)
    .set({
      status: input.status,
      decidedBy: input.decidedBy,
      decisionNote: input.decisionNote ?? null,
      decidedAt,
      updatedAt: sql`now()`,
    })
    .where(eq(employeeUnavailability.id, input.id));

  const updated = await getById(input.id);
  if (!updated) {
    throw new Error(`Unavailability request ${input.id} not found after update`);
  }
  return updated;
}
