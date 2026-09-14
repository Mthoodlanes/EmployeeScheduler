/**
 * Milestone 24: shared test-database safety check + isolation helper for
 * every `tests/unit/server/**` spec (8 repo files + 9 service files).
 *
 * Isolation strategy: this is a REAL shared Neon Postgres branch, not a
 * fresh `:memory:` SQLite database per test like the Phase 1 suite this
 * replaces — so isolation is done via `truncateAllTables()` in each test
 * file's `beforeEach`, using a single `TRUNCATE ... RESTART IDENTITY CASCADE`
 * rather than hand-ordered `DELETE`s: listing every table in one statement
 * makes Postgres resolve the FK-safe order itself (`CASCADE` also protects
 * against any future table added with a FK back into one of these), and
 * `RESTART IDENTITY` resets every identity sequence so each test starts from
 * predictable low ids, matching the old SQLite suite's fresh-`:memory:`-db
 * behavior as closely as possible.
 *
 * This requires running test FILES one at a time rather than in parallel
 * (see `vitest.config.ts`'s `fileParallelism: false`) — multiple files
 * truncating/inserting into the same shared tables concurrently would be
 * flaky by construction, since several of the ported scenarios assert exact
 * `listAll()`/count results that only hold if nothing else is touching the
 * table at the same time. Tests WITHIN one file already run sequentially by
 * default (Vitest doesn't parallelize `it()`s in one file unless `.concurrent`
 * is used), so a per-file `beforeEach` truncate is sufficient.
 *
 * Safety check: refuses to run at all unless `TEST_DATABASE_URL` is set and
 * resolves to a different host than `DATABASE_URL` — this file is imported
 * by every server db/service test, so the check runs before any of them can
 * touch a real connection.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '../../../server/src/db.js';

function hostOf(connectionString: string | undefined): string | null {
  if (!connectionString) return null;
  try {
    return new URL(connectionString).host;
  } catch {
    return null;
  }
}

const { TEST_DATABASE_URL } = process.env;
const PRODUCTION_DATABASE_URL = process.env.DATABASE_URL;

if (!TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Server db/service unit tests must never run against ' +
      'DATABASE_URL (production) and refuse to run at all without an explicit, separate ' +
      'test branch configured in .env.',
  );
}

const testHost = hostOf(TEST_DATABASE_URL);
const productionHost = hostOf(PRODUCTION_DATABASE_URL);
if (testHost !== null && testHost === productionHost) {
  throw new Error(
    'TEST_DATABASE_URL resolves to the same host as DATABASE_URL. Refusing to run tests ' +
      'that could read from or write to the production database.',
  );
}

// `server/src/db.ts`'s `getDb()` reads `process.env.DATABASE_URL` lazily, the
// first time a repository/service under test actually issues a query (well
// after every static `import` in a test file has already resolved) — so
// setting this here, before any test body runs, is sufficient regardless of
// import order within a given test file.
process.env.DATABASE_URL = TEST_DATABASE_URL;

const TABLES_IN_ANY_ORDER = [
  'employees',
  'employee_departments',
  'shift_templates',
  'scheduled_shifts',
  'time_off_requests',
  'employee_preferences',
  'employee_unavailability',
  'store_hours',
  'special_event_overrides',
  'notices',
  'schedule_publications',
];

/**
 * Wipes every table back to empty with fresh identity sequences. Call this
 * from a `beforeEach` in every server db/service test file for a clean,
 * known-empty starting point per test.
 */
export async function truncateAllTables(): Promise<void> {
  const db = getDb();
  await db.execute(sql.raw(`TRUNCATE TABLE ${TABLES_IN_ANY_ORDER.join(', ')} RESTART IDENTITY CASCADE`));
}

export interface TestActor {
  id: number;
  role: 'manager' | 'employee';
}
