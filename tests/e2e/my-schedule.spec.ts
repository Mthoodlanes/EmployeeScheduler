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

function formatIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatIso(date);
}

// This week's Monday, matching the app's own Monday-first week convention
// (`getWeekStart`/`getWeekDates`) — used as a stable anchor so the assigned
// shift, the "off" day and the approved time off day are always three
// distinct dates within the schedule board's/My Schedule's default visible
// week, regardless of what day the suite happens to run on.
function thisWeekMonday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
  const diffToMonday = (dayOfWeek + 6) % 7;
  return addDays(formatIso(today), -diffToMonday);
}

const monday = thisWeekMonday();
const shiftDate = monday; // Monday: gets the assigned shift.
const offDate = addDays(monday, 2); // Wednesday: no shift, no time off.
const timeOffDate = addDays(monday, 6); // Sunday: approved time off.

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

test('employee sees their own assigned shift, an off day, and approved time off on My Schedule', async () => {
  // First-run setup creates the manager account and logs them straight in.
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Create a Front Desk employee.
  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Alex Employee');
  await window.locator('#employee-username').fill('alex');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-front_desk').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Alex Employee');

  // A shared shift template so the assign-shift dialog has something to pick.
  await window.getByRole('link', { name: 'Shift Templates' }).click();
  await window.locator('#template-name').fill('Front Desk AM');
  await window.locator('#template-start').fill('08:00');
  await window.locator('#template-end').fill('14:00');
  await window.getByRole('button', { name: 'Add template' }).click();
  await expect(window.getByTestId('shift-templates-table')).toContainText('Front Desk AM');

  // Assign that template to Alex on this week's Monday (Front Desk tab is the default).
  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await window.getByTestId(`schedule-cell-2-${shiftDate}`).click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await window.locator('[data-testid^="assign-template-"]').first().click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();
  await expect(window.locator('[data-testid^="shift-card-"]')).toHaveCount(1);

  // Submit-on-behalf approved time off for Alex on this week's Sunday.
  await window.getByRole('link', { name: 'Request Time Off' }).click();
  await window.locator('#timeoff-on-behalf-of').selectOption({ label: 'Alex Employee' });
  await window.locator('#timeoff-start').fill(timeOffDate);
  await window.locator('#timeoff-end').fill(timeOffDate);
  await window.locator('#timeoff-reason').fill('Family event');
  await window.getByTestId('timeoff-submit').click();
  await window.getByRole('link', { name: 'Time Off Queue' }).click();
  await window.getByRole('tab', { name: 'Approved' }).click();
  await expect(window.getByTestId('timeoff-queue-table')).toContainText('Alex Employee');

  // Log out and log back in as Alex.
  await window.getByRole('button', { name: 'Log out' }).click();
  await window.getByTestId('login-username').fill('alex');
  await window.getByTestId('login-password').fill('password123');
  await window.getByTestId('login-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Monday: the assigned Front Desk shift shows with its department and resolved time.
  const mondayCard = window.getByTestId(`my-schedule-day-${shiftDate}`);
  await expect(mondayCard).toBeVisible();
  await expect(mondayCard).toContainText('Front Desk');
  await expect(mondayCard).toContainText('08:00–14:00');
  await expect(mondayCard.getByTestId(`my-schedule-off-${shiftDate}`)).not.toBeVisible();

  // Wednesday: no shift and no time off — a clear "Off" state.
  const offCard = window.getByTestId(`my-schedule-day-${offDate}`);
  await expect(offCard.getByTestId(`my-schedule-off-${offDate}`)).toBeVisible();
  await expect(offCard.getByTestId(`my-schedule-timeoff-${offDate}`)).not.toBeVisible();

  // Sunday: approved time off is called out explicitly.
  const timeOffCard = window.getByTestId(`my-schedule-day-${timeOffDate}`);
  await expect(timeOffCard.getByTestId(`my-schedule-timeoff-${timeOffDate}`)).toBeVisible();
  await expect(timeOffCard).toContainText('Approved time off');
  await expect(timeOffCard.getByTestId(`my-schedule-off-${timeOffDate}`)).not.toBeVisible();
});
