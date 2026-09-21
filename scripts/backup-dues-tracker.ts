/**
 * Dumps every row of the Secretary Apps dues-tracker's 4 tables (leagues,
 * teams, bowlers, weekly_entries) to a timestamped JSON file — nothing else
 * in the database is read or touched. Safe to run against production any
 * time; this is a plain read.
 *
 * Deliberately its own script rather than reusing `leagueService`/etc.:
 * those are scoped to what the Secretary UI needs (actor checks, one
 * league at a time) where this needs every row of every table, unfiltered,
 * exactly as stored — a `SELECT *` per table, kept as close to the raw
 * database representation as possible (numeric columns stay strings,
 * timestamps stay ISO strings) so `restore-dues-tracker.ts` can round-trip
 * them without any precision loss.
 *
 * Usage: npm run db:backup-dues -- [output-file]
 *   (defaults to backups/dues-tracker/dues-tracker-<timestamp>.json)
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { bowlers, leagues, teams, weeklyEntries } from '../server/src/db/schema.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1);
}

function defaultOutputPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `backups/dues-tracker/dues-tracker-${stamp}.json`;
}

const outputPath = process.argv[2] ?? defaultOutputPath();

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

try {
  const [leagueRows, teamRows, bowlerRows, weeklyEntryRows] = await Promise.all([
    db.select().from(leagues),
    db.select().from(teams),
    db.select().from(bowlers),
    db.select().from(weeklyEntries),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    leagues: leagueRows,
    teams: teamRows,
    bowlers: bowlerRows,
    weeklyEntries: weeklyEntryRows,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(backup, null, 2));

  console.log(`Backed up to ${outputPath}:`);
  console.log(`  ${leagueRows.length} leagues`);
  console.log(`  ${teamRows.length} teams`);
  console.log(`  ${bowlerRows.length} bowlers`);
  console.log(`  ${weeklyEntryRows.length} weekly entries`);
  process.exitCode = 0;
} catch (err) {
  console.error('Backup failed:', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
