import { asc, eq } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { bowlers } from '../schema.js';
import type { Bowler } from '../domain-types.js';

type BowlerRow = typeof bowlers.$inferSelect;

function toBowler(row: BowlerRow): Bowler {
  return {
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    status: row.status,
    phone: row.phone,
    lineageDiscount: row.lineageDiscount,
    prizeFundDiscount: row.prizeFundDiscount,
    dropNoticeWeek: row.dropNoticeWeek,
    notes: row.notes,
    depositPaid: Number(row.depositPaid),
    depositOptOut: row.depositOptOut,
    usbcCardPaid: row.usbcCardPaid,
    lastTwoWeeksPaid: Number(row.lastTwoWeeksPaid),
  };
}

export interface BowlerInput {
  name: string;
  status: Bowler['status'];
  phone: string;
  lineageDiscount: boolean;
  prizeFundDiscount: boolean;
  dropNoticeWeek: string;
  notes: string;
  depositPaid: number;
  depositOptOut: boolean;
  usbcCardPaid: boolean;
  lastTwoWeeksPaid: number;
}

type BowlerColumnValues = Omit<
  typeof bowlers.$inferInsert,
  'id' | 'teamId' | 'createdAt' | 'updatedAt'
>;

function toColumnValues(input: BowlerInput): BowlerColumnValues {
  return {
    name: input.name,
    status: input.status,
    phone: input.phone,
    lineageDiscount: input.lineageDiscount,
    prizeFundDiscount: input.prizeFundDiscount,
    dropNoticeWeek: input.dropNoticeWeek,
    notes: input.notes,
    depositPaid: input.depositPaid.toString(),
    depositOptOut: input.depositOptOut,
    usbcCardPaid: input.usbcCardPaid,
    lastTwoWeeksPaid: input.lastTwoWeeksPaid.toString(),
  };
}

export async function listByTeam(teamId: number): Promise<Bowler[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(bowlers)
    .where(eq(bowlers.teamId, teamId))
    .orderBy(asc(bowlers.name));
  return rows.map(toBowler);
}

/** Used by `duesLedger.ts` callers assembling a whole league's worth of entries at once (see leagueId join through teams). */
export async function listByTeamIds(teamIds: number[]): Promise<Bowler[]> {
  if (teamIds.length === 0) {
    return [];
  }
  const db = getDb();
  const rows = await db.select().from(bowlers);
  const teamIdSet = new Set(teamIds);
  return rows.filter((row) => teamIdSet.has(row.teamId)).map(toBowler);
}

export async function getById(id: number): Promise<Bowler | undefined> {
  const db = getDb();
  const [row] = await db.select().from(bowlers).where(eq(bowlers.id, id));
  return row ? toBowler(row) : undefined;
}

export async function create(teamId: number, input: BowlerInput): Promise<Bowler> {
  const db = getDb();
  const [inserted] = await db
    .insert(bowlers)
    .values({ ...toColumnValues(input), teamId })
    .returning({ id: bowlers.id });

  const created = await getById(inserted.id);
  if (!created) {
    throw new Error('Failed to load bowler immediately after creation');
  }
  return created;
}

export async function update(id: number, input: BowlerInput): Promise<Bowler> {
  const db = getDb();
  await db
    .update(bowlers)
    .set({ ...toColumnValues(input), updatedAt: new Date() })
    .where(eq(bowlers.id, id));

  const updated = await getById(id);
  if (!updated) {
    throw new Error(`Bowler ${id} not found after update`);
  }
  return updated;
}

/** Cascades to every weekly_entry for this bowler (see schema.ts's `onDelete: 'cascade'` chain). */
export async function remove(id: number): Promise<void> {
  const db = getDb();
  await db.delete(bowlers).where(eq(bowlers.id, id));
}
