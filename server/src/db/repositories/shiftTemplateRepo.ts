import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { shiftTemplates } from '../schema.js';
import type { Department, EndAnchor, ShiftTemplate, StartAnchor } from '../domain-types.js';

type ShiftTemplateRow = typeof shiftTemplates.$inferSelect;

function toShiftTemplate(row: ShiftTemplateRow): ShiftTemplate {
  return {
    id: row.id,
    department: row.department,
    name: row.name,
    startTime: row.startTime,
    endTime: row.endTime,
    startAnchor: row.startAnchor,
    endAnchor: row.endAnchor,
    color: row.color,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const DEFAULT_COLOR = '#D97706';

export interface CreateShiftTemplateInput {
  /** NULL creates a shared template usable from any of the three department tabs. */
  department: Department | null;
  name: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor?: StartAnchor;
  endAnchor?: EndAnchor;
  color?: string;
}

export interface UpdateShiftTemplateInput {
  id: number;
  name: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor: StartAnchor;
  endAnchor: EndAnchor;
  color: string;
  isActive: boolean;
}

/**
 * Lists every template. Department-specific rows sort ahead of shared
 * (`department IS NULL`) ones, since `department IS NULL` evaluates to
 * false/true and both SQLite and Postgres order `false` ahead of `true`
 * ascending — this keeps the schedule board's template picker showing a
 * department's own templates first, shared ones after.
 *
 * The middle `department` tiebreaker also needs an explicit `::text` cast:
 * `department` is a native Postgres enum here, and enums sort by their
 * declared ordinal (front_desk, cafe, bar) rather than lexicographically —
 * unlike the original SQLite column, which was plain TEXT and sorted
 * alphabetically (bar, cafe, front_desk). Without the cast, templates from
 * different departments would come back in enum-declaration order instead of
 * the original alphabetical order.
 *
 * The final `start_time` tiebreaker needs an explicit `NULLS FIRST`: SQLite
 * orders NULLs first by default in ascending order, but Postgres's default
 * for ascending order is NULLs LAST. Without the explicit clause, anchored
 * templates (`start_time IS NULL`) would sort to the end of their department
 * group on Postgres instead of the front like the original SQLite behavior.
 *
 * Both deviations were only caught by actually running this query against
 * real data with a mix of departments and null/non-null `start_time` rows
 * (see the Milestone 15 verification script) — not obvious from syntax alone.
 */
export async function listAll(): Promise<ShiftTemplate[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(shiftTemplates)
    .orderBy(
      sql`${shiftTemplates.department} IS NULL`,
      sql`${shiftTemplates.department}::text`,
      sql`${shiftTemplates.startTime} ASC NULLS FIRST`,
    );
  return rows.map(toShiftTemplate);
}

export async function getById(id: number): Promise<ShiftTemplate | undefined> {
  const db = getDb();
  const [row] = await db.select().from(shiftTemplates).where(eq(shiftTemplates.id, id));
  return row ? toShiftTemplate(row) : undefined;
}

/**
 * Finds a template by its exact department + name. `department` may be
 * `null` (a shared template) — Postgres's `=` is not null-safe (`NULL = NULL`
 * is `NULL`, not `TRUE`), so `IS NOT DISTINCT FROM` is used instead, the
 * direct equivalent of SQLite's null-safe `IS` used in the original query.
 */
export async function findByDepartmentAndName(
  department: Department | null,
  name: string,
): Promise<ShiftTemplate | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(shiftTemplates)
    .where(
      and(
        sql`${shiftTemplates.department} IS NOT DISTINCT FROM ${department}`,
        eq(shiftTemplates.name, name),
      ),
    );
  return row ? toShiftTemplate(row) : undefined;
}

export async function create(input: CreateShiftTemplateInput): Promise<ShiftTemplate> {
  const db = getDb();
  const [inserted] = await db
    .insert(shiftTemplates)
    .values({
      department: input.department,
      name: input.name,
      startTime: input.startTime,
      endTime: input.endTime,
      startAnchor: input.startAnchor ?? 'fixed',
      endAnchor: input.endAnchor ?? 'fixed',
      color: input.color ?? DEFAULT_COLOR,
    })
    .returning({ id: shiftTemplates.id });

  const created = await getById(inserted.id);
  if (!created) {
    throw new Error('Failed to load shift template immediately after creation');
  }
  return created;
}

export async function update(input: UpdateShiftTemplateInput): Promise<ShiftTemplate> {
  const db = getDb();
  await db
    .update(shiftTemplates)
    .set({
      name: input.name,
      startTime: input.startTime,
      endTime: input.endTime,
      startAnchor: input.startAnchor,
      endAnchor: input.endAnchor,
      color: input.color,
      isActive: input.isActive,
      updatedAt: sql`now()`,
    })
    .where(eq(shiftTemplates.id, input.id));

  const updated = await getById(input.id);
  if (!updated) {
    throw new Error(`Shift template ${input.id} not found after update`);
  }
  return updated;
}

export async function deactivate(id: number): Promise<ShiftTemplate> {
  const db = getDb();
  await db
    .update(shiftTemplates)
    .set({ isActive: false, updatedAt: sql`now()` })
    .where(eq(shiftTemplates.id, id));

  const updated = await getById(id);
  if (!updated) {
    throw new Error(`Shift template ${id} not found after deactivation`);
  }
  return updated;
}
