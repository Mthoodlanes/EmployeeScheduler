/**
 * Milestone 24: shared TEST_DATABASE_URL safety check for the Playwright
 * side of the suite (`playwright.config.ts`'s `webServer` + `global-setup.ts`),
 * mirroring `tests/unit/server/dbTestSetup.ts`'s identical check on the
 * Vitest side. Two independent copies, one per test runner, rather than one
 * shared module — Vitest and Playwright's config/global-setup run in
 * different processes/contexts, and this check is small enough that sharing
 * it isn't worth a cross-runner import.
 */
import 'dotenv/config';

function hostOf(connectionString: string | undefined): string | null {
  if (!connectionString) return null;
  try {
    return new URL(connectionString).host;
  } catch {
    return null;
  }
}

/**
 * Returns `TEST_DATABASE_URL`, having confirmed it exists and resolves to a
 * different host than `DATABASE_URL` (production). Throws otherwise —
 * called eagerly from `playwright.config.ts`'s module scope (so a
 * misconfigured `.env` fails before any browser/server is ever launched) and
 * again from `global-setup.ts` (defense in depth: config-time and run-time).
 */
export function getValidatedTestDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  const productionUrl = process.env.DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL is not set. E2E tests must never run against DATABASE_URL ' +
        '(production) and refuse to start without an explicit, separate test branch ' +
        'configured in .env.',
    );
  }

  const testHost = hostOf(testUrl);
  const productionHost = hostOf(productionUrl);
  if (testHost !== null && testHost === productionHost) {
    throw new Error(
      'TEST_DATABASE_URL resolves to the same host as DATABASE_URL. Refusing to run E2E ' +
        'tests that could read from or write to the production database.',
    );
  }

  return testUrl;
}
