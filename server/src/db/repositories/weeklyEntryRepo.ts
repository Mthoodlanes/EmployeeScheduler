import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { weeklyEntries } from '../schema.js';
import type { WeeklyEntry } from '../domain-types.js';

type WeeklyEntryRow = typeof weeklyEntries.$inferSelect;

function toWeeklyEntry(row: WeeklyEntryRow): WeeklyEntry {
  return {
    id: row.id,
    bowlerId: row.bowlerId,
    week: row.week,
    amountPaid: Number(row.amountPaid),
  };
}

export async function listByBowlerIds(bowlerIds: number[]): Promise<WeeklyEntry[]> {
  if (bowlerIds.length === 0) {
    return [];
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(weeklyEntries)
    .where(inArray(weeklyEntries.bowlerId, bowlerIds));
  return rows.map(toWeeklyEntry);
}

/**
 * One row per (bowler, week) by design (`weekly_entries_bowler_id_week_key` in
 * schema.ts) — re-entering a week's amount always corrects that same row
 * rather than creating a second one.
 */
export async function upsertAmount(
  bowlerId: number,
  week: number,
  amountPaid: number,
): Promise<WeeklyEntry> {
  const db = getDb();
  const [row] = await db
    .insert(weeklyEntries)
    .values({ bowlerId, week, amountPaid: amountPaid.toString() })
    .onConflictDoUpdate({
      target: [weeklyEntries.bowlerId, weeklyEntries.week],
      set: { amountPaid: amountPaid.toString(), updatedAt: new Date() },
    })
    .returning();

  return toWeeklyEntry(row);
}

export async function remove(bowlerId: number, week: number): Promise<void> {
  const db = getDb();
  await db
    .delete(weeklyEntries)
    .where(and(eq(weeklyEntries.bowlerId, bowlerId), eq(weeklyEntries.week, week)));
}
