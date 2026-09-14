import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { schedulePublications } from '../schema.js';
import type { Department, SchedulePublication } from '../domain-types.js';

type SchedulePublicationRow = typeof schedulePublications.$inferSelect;

function toSchedulePublication(row: SchedulePublicationRow): SchedulePublication {
  return {
    id: row.id,
    department: row.department,
    weekStart: row.weekStart,
    publishedByEmployeeId: row.publishedByEmployeeId,
    publishedAt: row.publishedAt.toISOString(),
  };
}

export async function getPublication(
  department: Department,
  weekStart: string,
): Promise<SchedulePublication | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schedulePublications)
    .where(
      and(
        eq(schedulePublications.department, department),
        eq(schedulePublications.weekStart, weekStart),
      ),
    );
  return row ? toSchedulePublication(row) : undefined;
}

export async function isPublished(department: Department, weekStart: string): Promise<boolean> {
  return (await getPublication(department, weekStart)) !== undefined;
}

/**
 * Publishes `department`'s `weekStart` week. Idempotent: publishing an
 * already-published week just re-stamps `publishedAt`/`publishedByEmployeeId`
 * rather than erroring or duplicating, via upsert on the unique
 * (department, week_start) pair.
 */
export async function publish(
  department: Department,
  weekStart: string,
  publishedByEmployeeId: number,
): Promise<SchedulePublication> {
  const db = getDb();
  await db
    .insert(schedulePublications)
    .values({ department, weekStart, publishedByEmployeeId })
    .onConflictDoUpdate({
      target: [schedulePublications.department, schedulePublications.weekStart],
      set: { publishedByEmployeeId, publishedAt: sql`now()` },
    });

  const publication = await getPublication(department, weekStart);
  if (!publication) {
    throw new Error(
      `Failed to load schedule publication for ${department}/${weekStart} after publish`,
    );
  }
  return publication;
}

/** No-ops if the week was never published. */
export async function unpublish(department: Department, weekStart: string): Promise<void> {
  const db = getDb();
  await db
    .delete(schedulePublications)
    .where(
      and(
        eq(schedulePublications.department, department),
        eq(schedulePublications.weekStart, weekStart),
      ),
    );
}
