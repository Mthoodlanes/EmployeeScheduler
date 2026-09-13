import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { employeePreferences } from '../schema.js';
import type { EmployeePreference } from '../domain-types.js';

type EmployeePreferenceRow = typeof employeePreferences.$inferSelect;

function toEmployeePreference(row: EmployeePreferenceRow): EmployeePreference {
  return {
    id: row.id,
    employeeId: row.employeeId,
    dayOfWeek: row.dayOfWeek,
    preferredStartTime: row.preferredStartTime,
    preferredEndTime: row.preferredEndTime,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

export async function getById(id: number): Promise<EmployeePreference | undefined> {
  const db = getDb();
  const [row] = await db.select().from(employeePreferences).where(eq(employeePreferences.id, id));
  return row ? toEmployeePreference(row) : undefined;
}

/** Lists every preference window for one employee, an employee may have several (multiple days, or multiple windows on one day). */
export async function listByEmployee(employeeId: number): Promise<EmployeePreference[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(employeePreferences)
    .where(eq(employeePreferences.employeeId, employeeId))
    .orderBy(asc(employeePreferences.dayOfWeek), asc(employeePreferences.preferredStartTime));
  return rows.map(toEmployeePreference);
}

/** Lists every preference window across every employee — used by the schedule grid's soft indicator. */
export async function listAll(): Promise<EmployeePreference[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(employeePreferences)
    .orderBy(
      asc(employeePreferences.employeeId),
      asc(employeePreferences.dayOfWeek),
      asc(employeePreferences.preferredStartTime),
    );
  return rows.map(toEmployeePreference);
}

export async function create(input: CreatePreferenceInput): Promise<EmployeePreference> {
  const db = getDb();
  const [inserted] = await db
    .insert(employeePreferences)
    .values({
      employeeId: input.employeeId,
      dayOfWeek: input.dayOfWeek,
      preferredStartTime: input.preferredStartTime,
      preferredEndTime: input.preferredEndTime,
      note: input.note ?? null,
    })
    .returning({ id: employeePreferences.id });

  const created = await getById(inserted.id);
  if (!created) {
    throw new Error('Failed to load employee preference immediately after creation');
  }
  return created;
}

export async function update(input: UpdatePreferenceInput): Promise<EmployeePreference> {
  const db = getDb();
  await db
    .update(employeePreferences)
    .set({
      dayOfWeek: input.dayOfWeek,
      preferredStartTime: input.preferredStartTime,
      preferredEndTime: input.preferredEndTime,
      note: input.note ?? null,
      updatedAt: sql`now()`,
    })
    .where(eq(employeePreferences.id, input.id));

  const updated = await getById(input.id);
  if (!updated) {
    throw new Error(`Employee preference ${input.id} not found after update`);
  }
  return updated;
}

export async function remove(id: number): Promise<void> {
  const db = getDb();
  await db.delete(employeePreferences).where(eq(employeePreferences.id, id));
}
