/**
 * Milestone 24: the ONE shared manager account for this whole E2E run.
 *
 * The Neon test branch starts genuinely empty (see `global-setup.ts`, which
 * truncates every table before the suite runs) and is shared across every
 * spec file in the run — unlike Phase 1's per-test isolated SQLite database
 * (a fresh `--user-data-dir` per test), there is no way to re-run first-run
 * setup per spec. `01-login.spec.ts` is the one spec that performs the real
 * first-run UI flow, creating this exact account; every other spec logs in
 * as this manager rather than repeating first-run setup. The numeric
 * filename prefixes across `tests/e2e/*.spec.ts` (01-12) exist SPECIFICALLY
 * to guarantee `01-login.spec.ts` runs first — Playwright discovers/orders
 * spec files alphabetically by default, and the suite already runs with
 * `workers: 1` / `fullyParallel: false` (see `playwright.config.ts`), so
 * this ordering is deterministic.
 */
export const MANAGER_NAME = 'Dana Manager';
export const MANAGER_USERNAME = 'dana';
export const MANAGER_PASSWORD = 'supersecret1';
