/**
 * Restores a backup produced by `backup-dues-tracker.ts`, replacing
 * whatever is currently in the 4 dues-tracker tables (leagues, teams,
 * bowlers, weekly_entries) with the exact contents of the backup file —
 * same rows, same ids, same timestamps.
 *
 * Isolation guarantee: this script only ever names those 4 tables, in one
 * `TRUNCATE` statement. No table outside the dues tracker has a foreign
 * key pointing INTO any of them (the only cross-reference runs the other
 * way — `leagues.created_by_employee_id` points AT `employees`), so this
 * cannot cascade into scheduling-side data (employees, shifts, time off,
 * etc.) no matter what. Confirmed by reading every `.references(...)` in
 * schema.ts before writing this.
 *
 * Explicit ids are preserved via `OVERRIDING SYSTEM VALUE` (all 4 tables'
 * `id` columns are `generatedAlwaysAsIdentity()`, which otherwise rejects
 * a manually-supplied id outright) — Drizzle's own `.insert().values()`
 * does NOT add this clause automatically (confirmed empirically against
 * the TEST branch before writing this), hence raw parameterized SQL here
 * instead of the usual repository layer. Each table's identity sequence
 * is reset to MAX(id)+1 afterward so the next normal insert (a secretary
 * creating a new league/team/bowler through the app) doesn't collide with
 * a restored id.
 *
 * Usage: npm run db:restore-dues -- path/to/backup.json --confirm
 *   (omit --confirm for a dry run that only prints what WOULD happen)
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

interface DuesBackup {
  exportedAt: string;
  leagues: Record<string, unknown>[];
  teams: Record<string, unknown>[];
  bowlers: Record<string, unknown>[];
  weeklyEntries: Record<string, unknown>[];
}

function isDuesBackup(value: unknown): value is DuesBackup {
  const v = value as Partial<DuesBackup> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    Array.isArray(v.leagues) &&
    Array.isArray(v.teams) &&
    Array.isArray(v.bowlers) &&
    Array.isArray(v.weeklyEntries)
  );
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const filePath = process.argv[2];
const confirmed = process.argv.includes('--confirm');

if (!filePath) {
  console.error('Usage: npm run db:restore-dues -- path/to/backup.json [--confirm]');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
if (!isDuesBackup(raw)) {
  console.error(`${filePath} doesn't look like a dues-tracker backup (missing leagues/teams/bowlers/weeklyEntries arrays).`);
  process.exit(1);
}
const backup = raw;

const sql = postgres(databaseUrl, { max: 1 });

try {
  const [[{ count: currentLeagues }], [{ count: currentTeams }], [{ count: currentBowlers }], [{ count: currentEntries }]] =
    await Promise.all([
      sql`select count(*)::int from leagues`,
      sql`select count(*)::int from teams`,
      sql`select count(*)::int from bowlers`,
      sql`select count(*)::int from weekly_entries`,
    ]);

  console.log(`Backup file: ${filePath} (exported ${backup.exportedAt})`);
  console.log('Rows currently in the database -> rows this restore will leave in place:');
  console.log(`  leagues:        ${currentLeagues} -> ${backup.leagues.length}`);
  console.log(`  teams:          ${currentTeams} -> ${backup.teams.length}`);
  console.log(`  bowlers:        ${currentBowlers} -> ${backup.bowlers.length}`);
  console.log(`  weekly entries: ${currentEntries} -> ${backup.weeklyEntries.length}`);

  if (!confirmed) {
    console.log('\nDry run only — nothing was changed. Re-run with --confirm to actually restore.');
    process.exitCode = 0;
  } else {
    await sql.begin(async (tx) => {
      // Named explicitly — see the file header on why this can never reach
      // scheduling-side tables.
      await tx`truncate table leagues, teams, bowlers, weekly_entries restart identity cascade`;

      for (const l of backup.leagues) {
        // eslint-disable-next-line no-await-in-loop -- a backup restore is a rare, small, one-off operation (dozens of rows at most); sequential inserts inside one transaction keep this simple and preserve insertion order.
        await tx`
          insert into leagues (
            id, name, spots_per_team, num_weeks, current_week, prize_fund, lineage,
            sweeper_active, sweeper_amount, vacancy_fee, lineage_discount_amount,
            prize_fund_discount_amount, sponsor_fee_per_team, sponsor_fee_active,
            deposit_fee_active, deposit_fee_amount, sponsor_fee_due_week,
            prize_fund_cover_charge_due_week, last_two_weeks_due_week, sanctioned_league,
            created_by_employee_id, created_at, updated_at
          ) overriding system value values (
            ${l.id as number}, ${l.name as string}, ${l.spotsPerTeam as number}, ${l.numWeeks as number},
            ${l.currentWeek as number}, ${l.prizeFund as string}, ${l.lineage as string},
            ${l.sweeperActive as boolean}, ${l.sweeperAmount as string}, ${l.vacancyFee as string},
            ${l.lineageDiscountAmount as string}, ${l.prizeFundDiscountAmount as string},
            ${l.sponsorFeePerTeam as string}, ${l.sponsorFeeActive as boolean},
            ${l.depositFeeActive as boolean}, ${l.depositFeeAmount as string},
            ${l.sponsorFeeDueWeek as number}, ${l.prizeFundCoverChargeDueWeek as number},
            ${l.lastTwoWeeksDueWeek as number}, ${l.sanctionedLeague as boolean},
            ${l.createdByEmployeeId as number}, ${l.createdAt as string}, ${l.updatedAt as string}
          )
        `;
      }

      for (const t of backup.teams) {
        // eslint-disable-next-line no-await-in-loop -- see the leagues loop above.
        await tx`
          insert into teams (id, league_id, name, folded, sponsor_paid, created_at, updated_at)
          overriding system value values (
            ${t.id as number}, ${t.leagueId as number}, ${t.name as string}, ${t.folded as boolean},
            ${t.sponsorPaid as string}, ${t.createdAt as string}, ${t.updatedAt as string}
          )
        `;
      }

      for (const b of backup.bowlers) {
        // eslint-disable-next-line no-await-in-loop -- see the leagues loop above.
        await tx`
          insert into bowlers (
            id, team_id, name, status, phone, lineage_discount, prize_fund_discount,
            drop_notice_week, notes, deposit_paid, deposit_opt_out, usbc_card_paid,
            last_two_weeks_paid, created_at, updated_at
          ) overriding system value values (
            ${b.id as number}, ${b.teamId as number}, ${b.name as string}, ${b.status as string},
            ${b.phone as string}, ${b.lineageDiscount as boolean}, ${b.prizeFundDiscount as boolean},
            ${b.dropNoticeWeek as string}, ${b.notes as string}, ${b.depositPaid as string},
            ${b.depositOptOut as boolean}, ${b.usbcCardPaid as boolean},
            ${b.lastTwoWeeksPaid as string}, ${b.createdAt as string}, ${b.updatedAt as string}
          )
        `;
      }

      for (const e of backup.weeklyEntries) {
        // eslint-disable-next-line no-await-in-loop -- see the leagues loop above.
        await tx`
          insert into weekly_entries (id, bowler_id, week, amount_paid, created_at, updated_at)
          overriding system value values (
            ${e.id as number}, ${e.bowlerId as number}, ${e.week as number},
            ${e.amountPaid as string}, ${e.createdAt as string}, ${e.updatedAt as string}
          )
        `;
      }

      for (const table of ['leagues', 'teams', 'bowlers', 'weekly_entries']) {
        // eslint-disable-next-line no-await-in-loop -- only 4 tables; sequential keeps this simple.
        await tx`
          select setval(
            pg_get_serial_sequence(${table}, 'id'),
            coalesce((select max(id) from ${tx(table)}), 0) + 1,
            false
          )
        `;
      }
    });

    console.log('\nRestore complete.');
    process.exitCode = 0;
  }
} catch (err) {
  console.error('Restore failed (transaction rolled back, nothing was changed):', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
