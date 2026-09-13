import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { _electron as electron } from 'playwright';
import type { ElectronApplication, Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mainPath = path.join(__dirname, '../../out/main/index.js');

/**
 * Milestone 23 smoke spec — the ONLY e2e spec left that uses Playwright's
 * `_electron` launcher (see the Phase 2 plan's Testing Migration section).
 * Every other former `_electron` spec exercised the app's own local
 * SQLite-backed backend via an isolated `--user-data-dir` per test; that
 * backend no longer exists — the shell now always points at ONE real,
 * shared, already-in-production server (`https://mymthoodlanes.com`, 24+
 * real employee accounts, active daily use), so there is no safe way to
 * seed/reset isolated state per test anymore. Full replacement e2e coverage
 * against the new architecture (a local test server + isolated test
 * database) is Milestone 24's job, not this one.
 *
 * This spec is therefore deliberately narrow and STRICTLY READ-ONLY against
 * the real production site:
 *  - it may load the real production URL and assert on read-only, stable
 *    DOM signals that prove the real site loaded — never anything that
 *    could change, like a specific employee's name or the current
 *    schedule;
 *  - it must NEVER log in, submit any form, or otherwise mutate data.
 *
 * It covers exactly the three things Milestone 23 could silently break:
 * the shell launches at all, it actually loads the configured `APP_URL`
 * (not a blank/error page), and the custom window chrome (Milestone 9)
 * still works now that the preload has shrunk to `windowControls` only.
 *
 * Deliberately does NOT assert on the app finishing its data bootstrap
 * (e.g. the "Employee Portal" login heading rendering) — that depends on
 * whichever renderer bundle happens to be deployed at `APP_URL` right now,
 * which this spec has no control over, rather than on anything this test
 * file itself is responsible for proving. The title-bar brand text below
 * renders unconditionally as part of the app shell regardless of how the
 * data bootstrap resolves, so it's a strictly reliable "the real site
 * loaded" signal. (The client.ts merge fix this milestone makes was
 * separately verified end-to-end — including a real, safe, invalid-
 * credentials login POST reaching `/api/auth/login` and failing gracefully
 * rather than crashing — against a local harness serving this build's own
 * renderer output proxied to the real read-only API; see the milestone
 * report for details, since exercising that here would require this
 * commit to already be deployed.)
 */

let electronApp: ElectronApplication;
let window: Page;

test.beforeEach(async () => {
  electronApp = await electron.launch({ args: [mainPath] });
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterEach(async () => {
  if (electronApp) {
    await electronApp.close().catch(() => {});
  }
});

test('shell launches and loads the real hosted site (read-only)', async () => {
  // Confirms the shell actually navigated to the configured `APP_URL`
  // rather than failing to load / staying on a blank window.
  expect(window.url()).toContain('mymthoodlanes.com');

  // The title bar's brand text (`TitleBar.tsx`) is part of the static app
  // shell and renders unconditionally, independent of the data bootstrap —
  // a stable, read-only, "the real site loaded" signal that can never
  // reflect anything sensitive (no employee data, no schedule content).
  await expect(window.getByText('Mt Hood Lanes Scheduler')).toBeVisible();

  // The custom window chrome (Milestone 9) rendered too — see the
  // dedicated window-controls tests below for driving them.
  await expect(window.getByRole('button', { name: 'Minimize window' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Close window' })).toBeVisible();
});

test('minimize and maximize buttons drive the real OS window (shrunk-preload bridge still works)', async () => {
  const electronWindow = await electronApp.browserWindow(window);

  // Minimize: drive the real in-app button (not a direct main-process call)
  // so this also proves the shrunk preload's `windowControls` bridge is
  // still wired end-to-end from a real click.
  await window.getByRole('button', { name: 'Minimize window' }).click();
  await expect.poll(() => electronWindow.evaluate((win) => win.isMinimized())).toBe(true);

  // Restore before checking maximize, so the two checks don't interfere.
  await electronWindow.evaluate((win) => win.restore());
  await expect.poll(() => electronWindow.evaluate((win) => win.isMinimized())).toBe(false);

  const boundsBeforeMaximize = await electronWindow.evaluate((win) => win.getBounds());

  await window.getByRole('button', { name: 'Maximize window' }).click();
  await expect.poll(() => electronWindow.evaluate((win) => win.isMaximized())).toBe(true);
  const boundsWhileMaximized = await electronWindow.evaluate((win) => win.getBounds());
  expect(boundsWhileMaximized.width).toBeGreaterThan(boundsBeforeMaximize.width);

  // Restore (the same button toggles back once maximized) — leaves the
  // window in a normal state for `afterEach`'s `electronApp.close()`.
  await window.getByRole('button', { name: 'Restore window' }).click();
  await expect.poll(() => electronWindow.evaluate((win) => win.isMaximized())).toBe(false);
});

test('close button actually quits the app', async () => {
  // Closing the shell's only window triggers `window-all-closed` ->
  // `app.quit()` (src/main/index.ts), same as before Milestone 23 — this
  // proves the shrunk preload's `windowControls.close` IPC call still
  // reaches the real BrowserWindow. `waitForEvent('close')` (rather than
  // polling `electronApp.windows().length`) is used because the app process
  // itself exits right after, which can otherwise race a poll.
  const closed = electronApp.waitForEvent('close');
  await window.getByRole('button', { name: 'Close window' }).click();
  await closed;
});
