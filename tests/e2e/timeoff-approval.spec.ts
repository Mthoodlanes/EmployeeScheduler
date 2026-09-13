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

function isoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Time off submitted for today so it always falls inside the schedule
// grid's default visible week (which is the week containing today).
const blockedDate = isoDate(0);
const secondRequestDate = isoDate(3);

test.beforeEach(async () => {
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

test('employee requests time off, manager approves it, the grid blocks the day and warns on scheduling over it; a second request can be denied with a note', async () => {
  // First-run setup creates the manager account and logs them straight in.
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Create an employee (Front Desk) who will request time off.
  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Alex Employee');
  await window.locator('#employee-username').fill('alex');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-front_desk').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Alex Employee');

  // Log out and log back in as Alex.
  await window.getByRole('button', { name: 'Log out' }).click();
  await window.getByTestId('login-username').fill('alex');
  await window.getByTestId('login-password').fill('password123');
  await window.getByTestId('login-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Submit a time-off request for today (so it lands in the grid's default week).
  await window.getByRole('link', { name: 'Request Time Off' }).click();
  await window.locator('#timeoff-start').fill(blockedDate);
  await window.locator('#timeoff-end').fill(blockedDate);
  await window.locator('#timeoff-reason').fill('Family trip');
  await window.getByTestId('timeoff-submit').click();
  await expect(window.getByTestId('my-timeoff-table')).toContainText('pending');

  // Submit a second request (a different date) that the manager will deny later.
  await window.locator('#timeoff-start').fill(secondRequestDate);
  await window.locator('#timeoff-end').fill(secondRequestDate);
  await window.locator('#timeoff-reason').fill('Concert');
  await window.getByTestId('timeoff-submit').click();
  await expect(window.getByTestId('my-timeoff-table')).toContainText('Concert');

  // Log out and log back in as the manager.
  await window.getByRole('button', { name: 'Log out' }).click();
  await window.getByTestId('login-username').fill('dana');
  await window.getByTestId('login-password').fill('supersecret1');
  await window.getByTestId('login-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Manager sees both pending requests in the queue and approves the "Family trip" one.
  await window.getByRole('link', { name: 'Time Off Queue' }).click();
  await expect(window.getByRole('heading', { name: 'Time Off Queue' })).toBeVisible();
  const queueTable = window.getByTestId('timeoff-queue-table');
  await expect(queueTable).toContainText('Alex Employee');
  await expect(queueTable).toContainText('Family trip');
  await expect(queueTable).toContainText('Concert');

  const familyTripRow = window.locator('tr', { hasText: 'Family trip' });
  await familyTripRow.getByTestId(/^timeoff-approve-/).click();

  // Approved requests move out of the default "Pending" filter.
  await expect(window.getByTestId('timeoff-queue-table')).not.toContainText('Family trip');
  await window.getByRole('tab', { name: 'Approved' }).click();
  await expect(window.getByTestId('timeoff-queue-table')).toContainText('Family trip');
  await expect(window.getByTestId('timeoff-queue-table')).toContainText('approved');

  // Deny the second ("Concert") request with a decision note.
  await window.getByRole('tab', { name: 'Pending' }).click();
  const concertRow = window.locator('tr', { hasText: 'Concert' });
  await concertRow.getByTestId(/^timeoff-deny-/).click();
  await expect(window.getByTestId('deny-timeoff-dialog')).toBeVisible();
  await window.locator('#deny-timeoff-note').fill('Short-staffed that week');
  await window.getByTestId('deny-timeoff-confirm').click();
  await expect(window.getByTestId('deny-timeoff-dialog')).toBeHidden();

  await window.getByRole('tab', { name: 'Denied' }).click();
  await expect(window.getByTestId('timeoff-queue-table')).toContainText('Concert');
  await expect(window.getByTestId('timeoff-queue-table')).toContainText('Short-staffed that week');

  // Schedule Board: Alex's cell for the approved date should now render as blocked.
  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  const blockedCell = window.getByTestId(`timeoff-blocked-2-${blockedDate}`);
  await expect(blockedCell).toBeVisible();
  await expect(blockedCell).toHaveText('Time Off');

  // Attempting to assign a shift on that blocked day shows a confirm interstitial.
  await window.getByTestId(`schedule-cell-2-${blockedDate}`).click();
  await expect(window.getByTestId('confirm-dialog')).toBeVisible();
  await expect(window.getByTestId('confirm-dialog')).toContainText('approved time off');
  // Cancel rather than confirm: proves the warning appears without needing a
  // shift template to exist yet.
  await window.getByTestId('confirm-dialog-cancel').click();
  await expect(window.getByTestId('confirm-dialog')).toBeHidden();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();
});
