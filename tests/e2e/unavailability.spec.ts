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

// The schedule grid's default visible week runs Monday-Sunday and always
// contains today (see `getWeekStart`/`getWeekDates`), so Sunday is whichever
// date 0-6 days from now has getDay() === 0.
function isoDateOfThisWeeksSunday(): string {
  const today = new Date();
  const offset = (7 - today.getDay()) % 7;
  return isoDate(offset);
}

// Manager-submit-on-behalf time off is created for a date well outside the
// current week so it can never coincide with (and thus never confuses) the
// Sunday-unavailability assignment scenario below, which happens on the
// schedule board's default (current) week.
const onBehalfTimeOffDate = isoDate(30);
const sundayDate = isoDateOfThisWeeksSunday();

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

test('employee submits unavailability, manager approves it and sees the panel/warning on the grid; manager-submit-on-behalf auto-approves time off', async () => {
  // First-run setup creates the manager account and logs them straight in.
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Create an employee (Front Desk) who will submit unavailability.
  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Alex Employee');
  await window.locator('#employee-username').fill('alex');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-front_desk').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Alex Employee');

  // A Front Desk shift template so the assign-shift dialog has something to pick.
  await window.getByRole('link', { name: 'Shift Templates' }).click();
  await window.locator('#template-name').fill('Front Desk AM');
  await window.locator('#template-start').fill('08:00');
  await window.locator('#template-end').fill('14:00');
  await window.getByRole('button', { name: 'Add template' }).click();
  await expect(window.getByTestId('shift-templates-table')).toContainText('Front Desk AM');

  // --- Manager-submit-on-behalf (time off): created already-approved. ---
  await window.getByRole('link', { name: 'Request Time Off' }).click();
  await window.locator('#timeoff-on-behalf-of').selectOption({ label: 'Alex Employee' });
  await window.locator('#timeoff-start').fill(onBehalfTimeOffDate);
  await window.locator('#timeoff-end').fill(onBehalfTimeOffDate);
  await window.locator('#timeoff-reason').fill("Can't submit it themselves");
  await window.getByTestId('timeoff-submit').click();

  await window.getByRole('link', { name: 'Time Off Queue' }).click();
  await expect(window.getByRole('heading', { name: 'Time Off Queue' })).toBeVisible();
  // It never appears under the default "Pending" filter — no separate approval
  // step — so the pending queue is empty rather than showing Alex awaiting review.
  await expect(window.getByText('No requests to show')).toBeVisible();
  await window.getByRole('tab', { name: 'Approved' }).click();
  await expect(window.getByTestId('timeoff-queue-table')).toContainText('Alex Employee');
  await expect(window.getByTestId('timeoff-queue-table')).toContainText('approved');

  // Log out and log back in as Alex.
  await window.getByRole('button', { name: 'Log out' }).click();
  await window.getByTestId('login-username').fill('alex');
  await window.getByTestId('login-password').fill('password123');
  await window.getByTestId('login-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Alex submits recurring unavailability: unavailable all day Sunday.
  await window.getByRole('link', { name: 'Request Time Off' }).click();
  await window.locator('#unavailability-day').selectOption({ label: 'Sunday' });
  await window.locator('#unavailability-full-day').check();
  await window.locator('#unavailability-reason').fill('Family commitments');
  await window.getByTestId('unavailability-submit').click();
  await expect(window.getByTestId('my-unavailability-table')).toContainText('Sunday');
  await expect(window.getByTestId('my-unavailability-table')).toContainText('pending');

  // Log out and log back in as the manager.
  await window.getByRole('button', { name: 'Log out' }).click();
  await window.getByTestId('login-username').fill('dana');
  await window.getByTestId('login-password').fill('supersecret1');
  await window.getByTestId('login-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Manager reviews and approves the unavailability request in its own queue tab.
  await window.getByRole('link', { name: 'Time Off Queue' }).click();
  await window.getByRole('tab', { name: 'Unavailability' }).click();
  const unavailabilityQueueTable = window.getByTestId('unavailability-queue-table');
  await expect(unavailabilityQueueTable).toContainText('Alex Employee');
  await expect(unavailabilityQueueTable).toContainText('Sunday');
  await unavailabilityQueueTable
    .locator('[data-testid^="unavailability-approve-"]')
    .first()
    .click();
  // Approved requests move out of the default "Pending" filter.
  await expect(window.getByText('No requests to show')).toBeVisible();
  await window.getByRole('tab', { name: 'Approved' }).click();
  await expect(unavailabilityQueueTable).toContainText('approved');

  // Schedule Board: open the assign dialog for Alex on this week's Sunday —
  // the informational unavailability panel should show up ahead of any
  // conflict.
  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await window.getByTestId(`schedule-cell-2-${sundayDate}`).click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await expect(window.getByTestId('unavailability-panel')).toBeVisible();
  await expect(window.getByTestId('unavailability-panel')).toContainText('All day');

  // Attempting to actually assign a shift that overlaps it shows the
  // warn/confirm interstitial, mirroring the approved-time-off pattern.
  await window.locator('[data-testid^="assign-template-"]').first().click();
  await expect(window.getByTestId('confirm-dialog')).toBeVisible();
  await expect(window.getByTestId('confirm-dialog')).toContainText('overlaps stated unavailability');
  await window.getByTestId('confirm-dialog-confirm').click();
  await expect(window.getByTestId('confirm-dialog')).toBeHidden();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();
  await expect(window.locator('[data-testid^="shift-card-"]')).toHaveCount(1);
});
