import { defineConfig } from '@playwright/test';
import { getValidatedTestDatabaseUrl } from './tests/e2e/env.js';

/**
 * Milestone 24: boots the full app (Express serving both `/api/*` and the
 * built static renderer, per Milestone 20) against the Neon TEST branch
 * before the suite runs, so the 12 newly-ported specs (`01-*.spec.ts`
 * through `12-*.spec.ts`) drive a real local server instead of `_electron`.
 *
 * Safety: `getValidatedTestDatabaseUrl()` throws immediately (before any
 * browser or server launches) unless `TEST_DATABASE_URL` is set and resolves
 * to a different host than `DATABASE_URL` — see `tests/e2e/env.ts`. The
 * resolved value is then passed EXPLICITLY as `webServer.env.DATABASE_URL`
 * below (Playwright merges `env` on top of the parent process's own
 * `process.env`, so this explicit override — not whatever `DATABASE_URL`
 * this config's own process happened to load via `dotenv/config` — is what
 * actually reaches the spawned server). `reuseExistingServer: false` always,
 * so this can never accidentally attach to a real already-running instance
 * (e.g. a developer's own `npm run server:dev` left open on the same port —
 * distinct port `TEST_SERVER_PORT` below also guards against that).
 *
 * `NODE_ENV: 'test'` (never `'production'`) is deliberate, not an oversight:
 * `server/src/auth/cookie.ts`'s session cookie sets `secure: true` only when
 * `NODE_ENV === 'production'`, and a `secure` cookie is silently dropped by
 * the browser over plain `http://localhost` — Playwright's browser would
 * then never actually receive/send the login session cookie and every
 * auth-gated spec would fail in a confusing way. `'test'` keeps the cookie
 * non-secure (matching local dev) while still being distinct from `'production'`
 * for anyone reading `NODE_ENV` in logs/telemetry.
 */
const TEST_SERVER_PORT = 3100;
const baseURL = `http://localhost:${TEST_SERVER_PORT}`;
const testDatabaseUrl = getValidatedTestDatabaseUrl();

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  // Milestone 24: truncates the TEST branch once before the whole run — see
  // tests/e2e/global-setup.ts for why (01-login.spec.ts's first-run scenario
  // needs a genuinely empty `employees` table).
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL,
  },
  webServer: {
    // Rebuilds both the renderer/main (electron-vite) and the server (tsc)
    // before starting, so this is never accidentally exercising stale
    // build output from an earlier, unrelated change.
    command: 'npm run build && npm run server:build && npm run server:start',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: 'test',
      PORT: String(TEST_SERVER_PORT),
    },
  },
});
