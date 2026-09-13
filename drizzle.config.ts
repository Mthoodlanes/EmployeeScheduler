import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Milestone 14: drizzle-kit config for the Phase 2 Postgres backend under
// `server/`. Deliberately lives at the project root (drizzle-kit's
// conventional location) even though the schema/migrations it points at are
// server-only — this file itself is infra tooling, not part of the Electron
// app or the Express server's own build (`tsconfig.server.json`).
const { DATABASE_URL: databaseUrl } = process.env;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/src/db/schema.ts',
  out: './server/drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
