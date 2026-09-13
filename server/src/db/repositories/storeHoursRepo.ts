import { asc, eq } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { storeHours } from '../schema.js';
import type { StoreHours } from '../domain-types.js';

type StoreHoursRow = typeof storeHours.$inferSelect;

function toStoreHours(row: StoreHoursRow): StoreHours {
  return {
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    openTime: row.openTime,
    closeTime: row.closeTime,
    isClosed: row.isClosed,
  };
}

export interface UpsertStoreHoursInput {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

/** Lists every configured weekly-default row (0-7 rows — a day with no row yet is simply absent). */
export async function listAll(): Promise<StoreHours[]> {
  const db = getDb();
  const rows = await db.select().from(storeHours).orderBy(asc(storeHours.dayOfWeek));
  return rows.map(toStoreHours);
}

export async function getByDayOfWeek(dayOfWeek: number): Promise<StoreHours | undefined> {
  const db = getDb();
  const [row] = await db.select().from(storeHours).where(eq(storeHours.dayOfWeek, dayOfWeek));
  return row ? toStoreHours(row) : undefined;
}

/**
 * Creates or replaces the single row for `dayOfWeek` (the table's `UNIQUE`
 * constraint on `day_of_week` makes this a natural upsert — there is never
 * more than one weekly-default row per day).
 */
export async function upsert(input: UpsertStoreHoursInput): Promise<StoreHours> {
  const db = getDb();
  const openTime = input.isClosed ? null : input.openTime;
  const closeTime = input.isClosed ? null : input.closeTime;

  await db
    .insert(storeHours)
    .values({
      dayOfWeek: input.dayOfWeek,
      openTime,
      closeTime,
      isClosed: input.isClosed,
    })
    .onConflictDoUpdate({
      target: storeHours.dayOfWeek,
      set: { openTime, closeTime, isClosed: input.isClosed },
    });

  const updated = await getByDayOfWeek(input.dayOfWeek);
  if (!updated) {
    throw new Error(`Store hours for day ${input.dayOfWeek} not found after upsert`);
  }
  return updated;
}
