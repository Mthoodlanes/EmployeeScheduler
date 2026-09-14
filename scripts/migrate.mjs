/**
 * Applies any pending `server/drizzle/*.sql` migration to `DATABASE_URL`.
 *
 * Deliberately NOT `drizzle-kit migrate` (the CLI) — that tool proved
 * unreliable against this project's Neon setup during Milestone 26's
 * session-revocation migration: with an empty `drizzle.__drizzle_migrations`
 * tracking table (even though the schema already matched migrations 0-2),
 * it tried to re-run already-applied migrations from scratch and failed on
 * "already exists" errors, with no clear error surfaced. This uses
 * drizzle-orm's own runtime `migrate()` instead (the same tracking-table
 * format, but the library's own well-tested apply path — the "run
 * migrations at boot" pattern most Drizzle+Postgres apps use), invoked here
 * as `render.yaml`'s `preDeployCommand` so every deploy applies whatever
 * migration got committed but never manually run, instead of that being an
 * easy-to-forget manual step (see the "schedule_publications" table missing
 * in production despite its migration being generated and committed).
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: 'server/drizzle' });
  console.log('Migrations applied (or already up to date).');
  process.exitCode = 0;
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
