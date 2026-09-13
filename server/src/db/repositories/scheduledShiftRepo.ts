import { and, asc, between, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { scheduledShifts } from '../schema.js';
import type { Department, EndAnchor, ScheduledShift, StartAnchor } from '../domain-types.js';

type ScheduledShiftRow = typeof scheduledShifts.$inferSelect;

function toScheduledShift(row: ScheduledShiftRow): ScheduledShift {
  return {
    id: row.id,
    employeeId: row.employeeId,
    department: row.department,
    shiftDate: row.shiftDate,
    startTime: row.startTime,
    endTime: row.endTime,
    startAnchor: row.startAnchor,
    endAnchor: row.endAnchor,
    templateId: row.templateId,
    isOverride: row.isOverride,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

export async function listByDepartmentAndDateRange(
  department: Department,
  startDate: string,
  endDate: string,
): Promise<ScheduledShift[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(scheduledShifts)
    .where(
      and(
        eq(scheduledShifts.department, department),
        between(scheduledShifts.shiftDate, startDate, endDate),
      ),
    )
    .orderBy(asc(scheduledShifts.shiftDate), asc(scheduledShifts.startTime));
  return rows.map(toScheduledShift);
}

export async function getById(id: number): Promise<ScheduledShift | undefined> {
  const db = getDb();
  const [row] = await db.select().from(scheduledShifts).where(eq(scheduledShifts.id, id));
  return row ? toScheduledShift(row) : undefined;
}

export async function create(input: CreateScheduledShiftInput): Promise<ScheduledShift> {
  const db = getDb();
  const [inserted] = await db
    .insert(scheduledShifts)
    .values({
      employeeId: input.employeeId,
      department: input.department,
      shiftDate: input.shiftDate,
      startTime: input.startTime,
      endTime: input.endTime,
      startAnchor: input.startAnchor ?? 'fixed',
      endAnchor: input.endAnchor ?? 'fixed',
      templateId: input.templateId,
      isOverride: input.isOverride,
      notes: input.notes ?? null,
    })
    .returning({ id: scheduledShifts.id });

  const created = await getById(inserted.id);
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
export async function updateOverride(
  input: UpdateScheduledShiftOverrideInput,
): Promise<ScheduledShift> {
  const db = getDb();
  await db
    .update(scheduledShifts)
    .set({
      startTime: input.startTime,
      endTime: input.endTime,
      startAnchor: 'fixed',
      endAnchor: 'fixed',
      isOverride: true,
      notes: input.notes ?? null,
      updatedAt: sql`now()`,
    })
    .where(eq(scheduledShifts.id, input.id));

  const updated = await getById(input.id);
  if (!updated) {
    throw new Error(`Scheduled shift ${input.id} not found after update`);
  }
  return updated;
}

export async function remove(id: number): Promise<void> {
  const db = getDb();
  await db.delete(scheduledShifts).where(eq(scheduledShifts.id, id));
}
