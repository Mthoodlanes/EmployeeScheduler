import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { bowlers, duesTrackerBackups, leagues, teams, weeklyEntries } from '../schema.js';
import type { DuesTrackerBackup } from '../domain-types.js';

type BackupRow = typeof duesTrackerBackups.$inferSelect;
type LeagueRow = typeof leagues.$inferSelect;
type TeamRow = typeof teams.$inferSelect;
type BowlerRow = typeof bowlers.$inferSelect;
type WeeklyEntryRow = typeof weeklyEntries.$inferSelect;

function toBackup(row: Omit<BackupRow, 'payload'>): DuesTrackerBackup {
  return {
    id: row.id,
    label: row.label,
    source: row.source,
    restoredFromBackupId: row.restoredFromBackupId,
    leagueCount: row.leagueCount,
    teamCount: row.teamCount,
    bowlerCount: row.bowlerCount,
    weeklyEntryCount: row.weeklyEntryCount,
    createdByEmployeeId: row.createdByEmployeeId,
    createdAt: row.createdAt.toISOString(),
  };
}

type JsonSafe<T> = Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };

/**
 * The jsonb-stored snapshot shape — JSON-safe (numeric columns are already
 * plain strings at runtime, straight from Postgres; timestamps are
 * converted to ISO strings explicitly, since a jsonb column round-trips
 * through JSON serialization regardless of what `schema.ts`'s
 * `$inferSelect` types claim — a `Date` doesn't survive that on its own).
 */
export interface DuesBackupPayload {
  exportedAt: string;
  leagues: JsonSafe<LeagueRow>[];
  teams: JsonSafe<TeamRow>[];
  bowlers: JsonSafe<BowlerRow>[];
  weeklyEntries: JsonSafe<WeeklyEntryRow>[];
}

interface SnapshotResult {
  payload: DuesBackupPayload;
  leagueCount: number;
  teamCount: number;
  bowlerCount: number;
  weeklyEntryCount: number;
}

function withIsoDates<T extends { createdAt: Date; updatedAt: Date }>(row: T): JsonSafe<T> {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function buildSnapshot(
  leagueRows: LeagueRow[],
  teamRows: TeamRow[],
  bowlerRows: BowlerRow[],
  weeklyEntryRows: WeeklyEntryRow[],
): SnapshotResult {
  return {
    payload: {
      exportedAt: new Date().toISOString(),
      leagues: leagueRows.map(withIsoDates),
      teams: teamRows.map(withIsoDates),
      bowlers: bowlerRows.map(withIsoDates),
      weeklyEntries: weeklyEntryRows.map(withIsoDates),
    },
    leagueCount: leagueRows.length,
    teamCount: teamRows.length,
    bowlerCount: bowlerRows.length,
    weeklyEntryCount: weeklyEntryRows.length,
  };
}

/** Every row of the 4 dues-tracker tables, exactly as they stand right now — used by both a manual "Create Backup" and the automatic pre-restore safety snapshot. */
export async function readCurrentSnapshot(): Promise<SnapshotResult> {
  const db = getDb();
  const [leagueRows, teamRows, bowlerRows, weeklyEntryRows] = await Promise.all([
    db.select().from(leagues),
    db.select().from(teams),
    db.select().from(bowlers),
    db.select().from(weeklyEntries),
  ]);
  return buildSnapshot(leagueRows, teamRows, bowlerRows, weeklyEntryRows);
}

/** List metadata only, newest first — never selects `payload` (avoids pulling a potentially large jsonb blob just to render a list row). */
export async function list(): Promise<DuesTrackerBackup[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: duesTrackerBackups.id,
      label: duesTrackerBackups.label,
      source: duesTrackerBackups.source,
      restoredFromBackupId: duesTrackerBackups.restoredFromBackupId,
      leagueCount: duesTrackerBackups.leagueCount,
      teamCount: duesTrackerBackups.teamCount,
      bowlerCount: duesTrackerBackups.bowlerCount,
      weeklyEntryCount: duesTrackerBackups.weeklyEntryCount,
      createdByEmployeeId: duesTrackerBackups.createdByEmployeeId,
      createdAt: duesTrackerBackups.createdAt,
    })
    .from(duesTrackerBackups)
    .orderBy(desc(duesTrackerBackups.createdAt));
  return rows.map(toBackup);
}

export async function getById(id: number): Promise<DuesTrackerBackup | undefined> {
  const db = getDb();
  const [row] = await db.select().from(duesTrackerBackups).where(eq(duesTrackerBackups.id, id));
  return row ? toBackup(row) : undefined;
}

export async function getPayload(id: number): Promise<DuesBackupPayload | undefined> {
  const db = getDb();
  const [row] = await db
    .select({ payload: duesTrackerBackups.payload })
    .from(duesTrackerBackups)
    .where(eq(duesTrackerBackups.id, id));
  return row ? (row.payload as DuesBackupPayload) : undefined;
}

export async function create(input: {
  label: string | null;
  createdByEmployeeId: number;
}): Promise<DuesTrackerBackup> {
  const db = getDb();
  const snapshot = await readCurrentSnapshot();
  const [inserted] = await db
    .insert(duesTrackerBackups)
    .values({
      label: input.label,
      source: 'manual',
      leagueCount: snapshot.leagueCount,
      teamCount: snapshot.teamCount,
      bowlerCount: snapshot.bowlerCount,
      weeklyEntryCount: snapshot.weeklyEntryCount,
      payload: snapshot.payload,
      createdByEmployeeId: input.createdByEmployeeId,
    })
    .returning();
  return toBackup(inserted);
}

/**
 * The actual restore. Inside ONE transaction:
 *   1. Snapshots current state into a new `source: 'pre_restore'` row —
 *      the safety net (an instant undo point) and the audit trail (who
 *      restored what, when — see schema.ts's comment on
 *      `restoredFromBackupId`) in one write.
 *   2. Truncates exactly the 4 dues-tracker tables, named explicitly —
 *      see schema.ts for why this can never reach scheduling-side data.
 *   3. Re-inserts every row from the target backup's payload with its
 *      ORIGINAL id. Requires `OVERRIDING SYSTEM VALUE`: every id column
 *      here is `generatedAlwaysAsIdentity()`, which otherwise rejects an
 *      explicit id outright — confirmed Drizzle's own `.insert().values()`
 *      does NOT add this clause automatically (tested against the TEST
 *      branch before writing this), hence raw SQL for these inserts
 *      specifically rather than the usual query builder.
 *   4. Resets each table's identity sequence to MAX(id)+1 so the next
 *      normal insert (a secretary creating a new league/team/bowler
 *      through the app) doesn't collide with a restored id.
 * Any failure at any step rolls back the ENTIRE transaction, including
 * the pre-restore snapshot — a failed restore is a complete no-op, never
 * a half-truncated table with an orphaned safety snapshot sitting around.
 */
export async function restore(
  backupId: number,
  restoredByEmployeeId: number,
): Promise<DuesTrackerBackup> {
  const target = await getPayload(backupId);
  if (!target) {
    throw new Error(`Backup ${backupId} not found`);
  }

  const db = getDb();
  return db.transaction(async (tx) => {
    const [leagueRows, teamRows, bowlerRows, weeklyEntryRows] = await Promise.all([
      tx.select().from(leagues),
      tx.select().from(teams),
      tx.select().from(bowlers),
      tx.select().from(weeklyEntries),
    ]);
    const currentSnapshot = buildSnapshot(leagueRows, teamRows, bowlerRows, weeklyEntryRows);

    const [preRestoreBackup] = await tx
      .insert(duesTrackerBackups)
      .values({
        label: null,
        source: 'pre_restore',
        restoredFromBackupId: backupId,
        leagueCount: currentSnapshot.leagueCount,
        teamCount: currentSnapshot.teamCount,
        bowlerCount: currentSnapshot.bowlerCount,
        weeklyEntryCount: currentSnapshot.weeklyEntryCount,
        payload: currentSnapshot.payload,
        createdByEmployeeId: restoredByEmployeeId,
      })
      .returning();

    await tx.execute(
      sql`truncate table leagues, teams, bowlers, weekly_entries restart identity cascade`,
    );

    for (const l of target.leagues) {
      // eslint-disable-next-line no-await-in-loop -- a restore is rare and small (dozens of rows at most); sequential inserts inside one transaction keep insertion order simple.
      await tx.execute(sql`
        insert into leagues (
          id, name, spots_per_team, num_weeks, current_week, prize_fund, lineage,
          sweeper_active, sweeper_amount, vacancy_fee, lineage_discount_amount,
          prize_fund_discount_amount, sponsor_fee_per_team, sponsor_fee_active,
          deposit_fee_active, deposit_fee_amount, sponsor_fee_due_week,
          prize_fund_cover_charge_due_week, last_two_weeks_due_week, sanctioned_league,
          created_by_employee_id, created_at, updated_at
        ) overriding system value values (
          ${l.id}, ${l.name}, ${l.spotsPerTeam}, ${l.numWeeks}, ${l.currentWeek},
          ${l.prizeFund}, ${l.lineage}, ${l.sweeperActive}, ${l.sweeperAmount},
          ${l.vacancyFee}, ${l.lineageDiscountAmount}, ${l.prizeFundDiscountAmount},
          ${l.sponsorFeePerTeam}, ${l.sponsorFeeActive}, ${l.depositFeeActive},
          ${l.depositFeeAmount}, ${l.sponsorFeeDueWeek}, ${l.prizeFundCoverChargeDueWeek},
          ${l.lastTwoWeeksDueWeek}, ${l.sanctionedLeague}, ${l.createdByEmployeeId},
          ${l.createdAt}, ${l.updatedAt}
        )
      `);
    }

    for (const t of target.teams) {
      // eslint-disable-next-line no-await-in-loop -- see the leagues loop above.
      await tx.execute(sql`
        insert into teams (id, league_id, name, folded, sponsor_paid, created_at, updated_at)
        overriding system value values (
          ${t.id}, ${t.leagueId}, ${t.name}, ${t.folded}, ${t.sponsorPaid},
          ${t.createdAt}, ${t.updatedAt}
        )
      `);
    }

    for (const b of target.bowlers) {
      // eslint-disable-next-line no-await-in-loop -- see the leagues loop above.
      await tx.execute(sql`
        insert into bowlers (
          id, team_id, name, status, phone, lineage_discount, prize_fund_discount,
          drop_notice_week, notes, deposit_paid, deposit_opt_out, usbc_card_paid,
          last_two_weeks_paid, created_at, updated_at
        ) overriding system value values (
          ${b.id}, ${b.teamId}, ${b.name}, ${b.status}, ${b.phone}, ${b.lineageDiscount},
          ${b.prizeFundDiscount}, ${b.dropNoticeWeek}, ${b.notes}, ${b.depositPaid},
          ${b.depositOptOut}, ${b.usbcCardPaid}, ${b.lastTwoWeeksPaid},
          ${b.createdAt}, ${b.updatedAt}
        )
      `);
    }

    for (const e of target.weeklyEntries) {
      // eslint-disable-next-line no-await-in-loop -- see the leagues loop above.
      await tx.execute(sql`
        insert into weekly_entries (id, bowler_id, week, amount_paid, created_at, updated_at)
        overriding system value values (
          ${e.id}, ${e.bowlerId}, ${e.week}, ${e.amountPaid}, ${e.createdAt}, ${e.updatedAt}
        )
      `);
    }

    await tx.execute(
      sql`select setval(pg_get_serial_sequence('leagues', 'id'), coalesce((select max(id) from leagues), 0) + 1, false)`,
    );
    await tx.execute(
      sql`select setval(pg_get_serial_sequence('teams', 'id'), coalesce((select max(id) from teams), 0) + 1, false)`,
    );
    await tx.execute(
      sql`select setval(pg_get_serial_sequence('bowlers', 'id'), coalesce((select max(id) from bowlers), 0) + 1, false)`,
    );
    await tx.execute(
      sql`select setval(pg_get_serial_sequence('weekly_entries', 'id'), coalesce((select max(id) from weekly_entries), 0) + 1, false)`,
    );

    return toBackup(preRestoreBackup);
  });
}
