import { desc, eq } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { leagues } from '../schema.js';
import type { League } from '../domain-types.js';

type LeagueRow = typeof leagues.$inferSelect;

/**
 * Postgres `numeric` columns come back as strings (to avoid silent
 * precision loss over the wire) — every money field is parsed to a
 * `number` right here, once, so everything above the repo layer
 * (`duesLedger.ts`, the UI) works with ordinary numbers exactly like the
 * original Electron app did.
 */
function toLeague(row: LeagueRow): League {
  return {
    id: row.id,
    name: row.name,
    spotsPerTeam: row.spotsPerTeam,
    numWeeks: row.numWeeks,
    currentWeek: row.currentWeek,
    prizeFund: Number(row.prizeFund),
    lineage: Number(row.lineage),
    sweeperActive: row.sweeperActive,
    sweeperAmount: Number(row.sweeperAmount),
    vacancyFee: Number(row.vacancyFee),
    lineageDiscountAmount: Number(row.lineageDiscountAmount),
    prizeFundDiscountAmount: Number(row.prizeFundDiscountAmount),
    sponsorFeePerTeam: Number(row.sponsorFeePerTeam),
    sponsorFeeActive: row.sponsorFeeActive,
    depositFeeActive: row.depositFeeActive,
    depositFeeAmount: Number(row.depositFeeAmount),
    sponsorFeeDueWeek: row.sponsorFeeDueWeek,
    prizeFundCoverChargeDueWeek: row.prizeFundCoverChargeDueWeek,
    lastTwoWeeksDueWeek: row.lastTwoWeeksDueWeek,
    sanctionedLeague: row.sanctionedLeague,
    createdByEmployeeId: row.createdByEmployeeId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface LeagueInput {
  name: string;
  spotsPerTeam: number;
  numWeeks: number;
  currentWeek: number;
  prizeFund: number;
  lineage: number;
  sweeperActive: boolean;
  sweeperAmount: number;
  vacancyFee: number;
  lineageDiscountAmount: number;
  prizeFundDiscountAmount: number;
  sponsorFeePerTeam: number;
  sponsorFeeActive: boolean;
  depositFeeActive: boolean;
  depositFeeAmount: number;
  sponsorFeeDueWeek: number;
  prizeFundCoverChargeDueWeek: number;
  lastTwoWeeksDueWeek: number;
  sanctionedLeague: boolean;
}

type LeagueColumnValues = Omit<
  typeof leagues.$inferInsert,
  'id' | 'createdByEmployeeId' | 'createdAt' | 'updatedAt'
>;

function toColumnValues(input: LeagueInput): LeagueColumnValues {
  return {
    name: input.name,
    spotsPerTeam: input.spotsPerTeam,
    numWeeks: input.numWeeks,
    currentWeek: input.currentWeek,
    prizeFund: input.prizeFund.toString(),
    lineage: input.lineage.toString(),
    sweeperActive: input.sweeperActive,
    sweeperAmount: input.sweeperAmount.toString(),
    vacancyFee: input.vacancyFee.toString(),
    lineageDiscountAmount: input.lineageDiscountAmount.toString(),
    prizeFundDiscountAmount: input.prizeFundDiscountAmount.toString(),
    sponsorFeePerTeam: input.sponsorFeePerTeam.toString(),
    sponsorFeeActive: input.sponsorFeeActive,
    depositFeeActive: input.depositFeeActive,
    depositFeeAmount: input.depositFeeAmount.toString(),
    sponsorFeeDueWeek: input.sponsorFeeDueWeek,
    prizeFundCoverChargeDueWeek: input.prizeFundCoverChargeDueWeek,
    lastTwoWeeksDueWeek: input.lastTwoWeeksDueWeek,
    sanctionedLeague: input.sanctionedLeague,
  };
}

/** Every Secretary-area user sees every league — nothing here is scoped per-creator (see schema.ts's comment). Newest first, matching the source app's "Choose a League" screen showing recently-active leagues up top. */
export async function listAll(): Promise<League[]> {
  const db = getDb();
  const rows = await db.select().from(leagues).orderBy(desc(leagues.createdAt));
  return rows.map(toLeague);
}

export async function getById(id: number): Promise<League | undefined> {
  const db = getDb();
  const [row] = await db.select().from(leagues).where(eq(leagues.id, id));
  return row ? toLeague(row) : undefined;
}

export async function create(input: LeagueInput, createdByEmployeeId: number): Promise<League> {
  const db = getDb();
  const [inserted] = await db
    .insert(leagues)
    .values({ ...toColumnValues(input), createdByEmployeeId })
    .returning({ id: leagues.id });

  const created = await getById(inserted.id);
  if (!created) {
    throw new Error('Failed to load league immediately after creation');
  }
  return created;
}

export async function update(id: number, input: LeagueInput): Promise<League> {
  const db = getDb();
  await db
    .update(leagues)
    .set({ ...toColumnValues(input), updatedAt: new Date() })
    .where(eq(leagues.id, id));

  const updated = await getById(id);
  if (!updated) {
    throw new Error(`League ${id} not found after update`);
  }
  return updated;
}

/** Cascades to every team/bowler/weekly_entry under this league (see schema.ts's `onDelete: 'cascade'` chain). */
export async function remove(id: number): Promise<void> {
  const db = getDb();
  await db.delete(leagues).where(eq(leagues.id, id));
}
