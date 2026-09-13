import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { timeOffRequests } from '../schema.js';
import type { TimeOffRequest, TimeOffStatus } from '../domain-types.js';

type TimeOffRequestRow = typeof timeOffRequests.$inferSelect;

function toTimeOffRequest(row: TimeOffRequestRow): TimeOffRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    status: row.status,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

export async function getById(id: number): Promise<TimeOffRequest | undefined> {
  const db = getDb();
  const [row] = await db.select().from(timeOffRequests).where(eq(timeOffRequests.id, id));
  return row ? toTimeOffRequest(row) : undefined;
}

/** Lists every request for one employee, most recent start date first. */
export async function listByEmployee(employeeId: number): Promise<TimeOffRequest[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(timeOffRequests)
    .where(eq(timeOffRequests.employeeId, employeeId))
    .orderBy(desc(timeOffRequests.startDate), desc(timeOffRequests.id));
  return rows.map(toTimeOffRequest);
}

/** Lists every request across all employees, pending requests first — used by the manager queue. */
export async function listAll(): Promise<TimeOffRequest[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(timeOffRequests)
    .orderBy(
      sql`case when ${timeOffRequests.status} = 'pending' then 0 else 1 end`,
      asc(timeOffRequests.startDate),
    );
  return rows.map(toTimeOffRequest);
}

/** Lists approved requests whose date range overlaps [startDate, endDate] (both inclusive). */
export async function listApprovedInDateRange(
  startDate: string,
  endDate: string,
): Promise<TimeOffRequest[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.status, 'approved'),
        lte(timeOffRequests.startDate, endDate),
        gte(timeOffRequests.endDate, startDate),
      ),
    )
    .orderBy(asc(timeOffRequests.startDate));
  return rows.map(toTimeOffRequest);
}

export async function create(input: CreateTimeOffRequestInput): Promise<TimeOffRequest> {
  const db = getDb();
  const [inserted] = await db
    .insert(timeOffRequests)
    .values({
      employeeId: input.employeeId,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason ?? null,
    })
    .returning({ id: timeOffRequests.id });

  const created = await getById(inserted.id);
  if (!created) {
    throw new Error('Failed to load time-off request immediately after creation');
  }
  return created;
}

/** Records a manager's decision: sets status, decided_by, decision_note and stamps decided_at. */
export async function updateStatus(input: UpdateTimeOffStatusInput): Promise<TimeOffRequest> {
  const db = getDb();
  // `decided_at` stays a plain TEXT column in the schema (see schema.ts's
  // translation notes), so it is stamped from JS with the same
  // `YYYY-MM-DDTHH:mm:ss.sssZ` shape the original SQLite `strftime` produced,
  // rather than `sql`now()`` — Postgres has no implicit cast from
  // `timestamptz` to `text`, which `now()` would otherwise require here.
  const decidedAt = new Date().toISOString();
  await db
    .update(timeOffRequests)
    .set({
      status: input.status,
      decidedBy: input.decidedBy,
      decisionNote: input.decisionNote ?? null,
      decidedAt,
      updatedAt: sql`now()`,
    })
    .where(eq(timeOffRequests.id, input.id));

  const updated = await getById(input.id);
  if (!updated) {
    throw new Error(`Time-off request ${input.id} not found after update`);
  }
  return updated;
}
