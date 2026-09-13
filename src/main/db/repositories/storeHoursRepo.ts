import { getDb } from '../connection';
import type { StoreHours } from '../../../shared/types/domain';

interface StoreHoursRow {
  id: number;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: number;
}

function toStoreHours(row: StoreHoursRow): StoreHours {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    openTime: row.open_time,
    closeTime: row.close_time,
    isClosed: row.is_closed === 1,
  };
}

export interface UpsertStoreHoursInput {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

/** Lists every configured weekly-default row (0-7 rows — a day with no row yet is simply absent). */
export function listAll(): StoreHours[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM store_hours ORDER BY day_of_week')
    .all() as StoreHoursRow[];
  return rows.map(toStoreHours);
}

export function getByDayOfWeek(dayOfWeek: number): StoreHours | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM store_hours WHERE day_of_week = ?').get(dayOfWeek) as
    StoreHoursRow | undefined;
  return row ? toStoreHours(row) : undefined;
}

/**
 * Creates or replaces the single row for `dayOfWeek` (the table's `UNIQUE`
 * constraint on `day_of_week` makes this a natural upsert — there is never
 * more than one weekly-default row per day).
 */
export function upsert(input: UpsertStoreHoursInput): StoreHours {
  const db = getDb();
  db.prepare(
    `INSERT INTO store_hours (day_of_week, open_time, close_time, is_closed)
     VALUES (@dayOfWeek, @openTime, @closeTime, @isClosed)
     ON CONFLICT(day_of_week) DO UPDATE SET
       open_time = excluded.open_time,
       close_time = excluded.close_time,
       is_closed = excluded.is_closed`,
  ).run({
    dayOfWeek: input.dayOfWeek,
    openTime: input.isClosed ? null : input.openTime,
    closeTime: input.isClosed ? null : input.closeTime,
    isClosed: input.isClosed ? 1 : 0,
  });

  const updated = getByDayOfWeek(input.dayOfWeek);
  if (!updated) {
    throw new Error(`Store hours for day ${input.dayOfWeek} not found after upsert`);
  }
  return updated;
}
