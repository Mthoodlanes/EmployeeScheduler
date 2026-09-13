import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { _electron as electron } from 'playwright';
import type { ElectronApplication, Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mainPath = path.join(__dirname, '../../out/main/index.js');

let electronApp: ElectronApplication;
let window: Page;
let userDataDir: string;

test.beforeEach(async () => {
  // Fresh, isolated userData dir per test so the app always starts in
  // "first run" state, regardless of what's in the developer's real app data.
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mhl-e2e-'));
  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${userDataDir}`],
  });
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterEach(async () => {
  await electronApp.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

async function firstRunSetup(): Promise<void> {
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
}

/** The Wednesday of NEXT week, Monday-start, matching the app's `weekRange.ts` convention. */
function nextWeekWednesdayIso(): string {
  const now = new Date();
  const utcToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const diffToMonday = (utcToday.getUTCDay() + 6) % 7;
  const thisMonday = new Date(utcToday.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
  const nextWednesday = new Date(thisMonday.getTime() + 9 * 24 * 60 * 60 * 1000);
  return nextWednesday.toISOString().slice(0, 10);
}

test('manager sets weekly default hours, adds a special event override, and it appears on the schedule board', async () => {
  await firstRunSetup();

  await window.getByRole('link', { name: 'Store Hours' }).click();
  await expect(window.getByRole('heading', { name: 'Store Hours' })).toBeVisible();
  await expect(window.getByTestId('store-hours-table')).toBeVisible();

  // Set Wednesday's (index 3) weekly default hours and save just that row.
  await window.getByTestId('store-hours-open-3').fill('09:00');
  await window.getByTestId('store-hours-close-3').fill('21:00');
  await window.getByTestId('store-hours-save-3').click();
  await expect(window.getByTestId('store-hours-saved-3')).toBeVisible();

  // Reload the whole renderer (clears the in-memory query cache but not the
  // main-process session/DB) to confirm the change actually persisted rather
  // than only living in client-side cache.
  await window.reload();
  await window.waitForLoadState('domcontentloaded');
  await expect(window.getByRole('heading', { name: 'Store Hours' })).toBeVisible();
  await expect(window.getByTestId('store-hours-open-3')).toHaveValue('09:00');
  await expect(window.getByTestId('store-hours-close-3')).toHaveValue('21:00');

  // Edit it again to confirm the editor round-trips an existing value too.
  await window.getByTestId('store-hours-close-3').fill('22:00');
  await window.getByTestId('store-hours-save-3').click();
  await expect(window.getByTestId('store-hours-saved-3')).toBeVisible();

  // Add a special event override for a specific near-future date with custom
  // hours and a required label.
  const eventDate = nextWeekWednesdayIso();
  await window.locator('#special-event-date').fill(eventDate);
  await window.locator('#special-event-label').fill('League Night — opens early');
  await window.locator('#special-event-open').fill('08:00');
  await window.locator('#special-event-close').fill('22:00');
  await window.getByTestId('special-event-submit').click();
  await expect(window.getByTestId('special-events-table')).toContainText(
    'League Night — opens early',
  );
  await expect(window.getByTestId('special-events-table')).toContainText(eventDate);

  // The schedule grid only renders its day-column headers once at least one
  // employee is assigned to the active department's tab (Front Desk, by
  // default) — otherwise it short-circuits to an empty-state message.
  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Sam Employee');
  await window.locator('#employee-username').fill('sam');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-front_desk').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Sam Employee');

  // Open the Schedule Board and navigate to next week, where the override date falls.
  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await window.getByRole('button', { name: 'Next week →' }).click();

  // That date's column header shows the special-event badge with its label
  // instead of the plain default hours.
  const eventBadge = window.getByTestId('hours-badge-event');
  await expect(eventBadge).toBeVisible();
  await expect(eventBadge).toContainText('League Night — opens early');
  await expect(eventBadge).toContainText('08:00–22:00');
});
