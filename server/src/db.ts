import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// Milestone 13: no schema tables exist yet (that's Milestone 14) — this module
// just proves a real connection to the Neon Postgres database works. The
// underlying `postgres` client is created lazily (not at import time) so a
// missing/invalid `DATABASE_URL` surfaces as a normal error the `/api/health`
// route can catch and report, rather than crashing the process on startup.
let sqlClient: ReturnType<typeof postgres> | undefined;

function getSqlClient(): ReturnType<typeof postgres> {
  if (!sqlClient) {
    const { DATABASE_URL: databaseUrl } = process.env;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set.');
    }
    sqlClient = postgres(databaseUrl, { max: 1 });
  }
  return sqlClient;
}

export function getDb(): PostgresJsDatabase {
  return drizzle(getSqlClient());
}
