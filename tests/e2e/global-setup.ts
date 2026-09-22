/**
 * Milestone 24: Playwright `globalSetup` — runs once before the whole E2E
 * suite. Truncates every table on the Neon TEST branch directly via
 * Drizzle/postgres (never via HTTP, so this has no dependency on the
 * `webServer` being up yet, sidestepping any ambiguity about globalSetup vs.
 * webServer startup ordering).
 *
 * Why this matters even though the branch is "meant to be reused/re-truncated
 * by future runs" (a prior run may leave it non-empty): `01-login.spec.ts`
 * exercises the real first-run signup flow, which only renders when the
 * `employees` table is empty — a leftover row from a previous run would
 * silently skip straight to the login screen and break that spec. This also
 * doubles as this milestone's isolation strategy for the E2E side: rather
 * than resetting between specs (impossible without a per-test `--user-data-dir`
 * the way Phase 1 had), the whole run gets ONE guaranteed-clean starting
 * point and every spec is responsible for using run-unique employee
 * names/usernames from then on (see `helpers.ts`'s `uniqueId()`).
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getValidatedTestDatabaseUrl } from './env.js';

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
  'leagues',
  'teams',
  'bowlers',
  'weekly_entries',
  'dues_tracker_backups',
];

export default async function globalSetup(): Promise<void> {
  const testDatabaseUrl = getValidatedTestDatabaseUrl();
  const client = postgres(testDatabaseUrl, { max: 1 });
  try {
    const db = drizzle(client);
    await db.execute(
      sql.raw(`TRUNCATE TABLE ${TABLES_IN_ANY_ORDER.join(', ')} RESTART IDENTITY CASCADE`),
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}
