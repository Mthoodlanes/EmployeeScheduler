import { expect, test } from '@playwright/test';
import { assignButtonFor, login, loginAsManager, logout, uniqueName, uniqueUsername } from './helpers.js';

/**
 * Milestone 24: ported from the deleted `tests/e2e/my-schedule.spec.ts`. My
 * Schedule only ever shows the logged-in employee's own days, so its
 * `my-schedule-day-*` testids need no employee-id/name scoping the way the
 * Schedule Board's shared grid does — the only adaptation here is using a
 * uniquely-named employee/template so this spec's own data is unambiguous.
 */
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

// This week's Monday, matching the app's own Monday-first week convention —
// used as a stable anchor so the assigned shift, the "off" day and the
// approved time off day are always three distinct dates within the schedule
// board's/My Schedule's default visible week, regardless of what day the
// suite happens to run on.
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

test('employee sees their own assigned shift, an off day, and approved time off on My Schedule', async ({
  page,
}) => {
  await loginAsManager(page);

  const employeeName = uniqueName('Alex Employee');
  const username = uniqueUsername('alex');

  // Create a Front Desk employee.
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(username);
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  // A shift template so the assign-shift dialog has something to pick.
  const templateName = uniqueName('Front Desk AM');
  await page.getByRole('link', { name: 'Shift Templates' }).click();
  await page.locator('#template-name').fill(templateName);
  await page.locator('#template-start').fill('08:00');
  await page.locator('#template-end').fill('14:00');
  await page.getByRole('button', { name: 'Add template' }).click();
  await expect(page.getByTestId('shift-templates-table')).toContainText(templateName);

  // Assign that template to the employee on this week's Monday (Front Desk tab is the default).
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await assignButtonFor(page, employeeName, shiftDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(templateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  // Submit-on-behalf approved time off for the employee on this week's Sunday.
  await page.getByRole('link', { name: 'Request Time Off' }).click();
  await page.locator('#timeoff-on-behalf-of').selectOption({ label: employeeName });
  await page.locator('#timeoff-start').fill(timeOffDate);
  await page.locator('#timeoff-end').fill(timeOffDate);
  await page.locator('#timeoff-reason').fill('Family event');
  await page.getByTestId('timeoff-submit').click();
  await page.getByRole('link', { name: 'Time Off Queue' }).click();
  await page.getByRole('tab', { name: 'Approved' }).click();
  await expect(page.locator('tr', { hasText: employeeName })).toBeVisible();

  // Log out and log back in as the employee.
  await logout(page);
  await login(page, username, 'password123');
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Monday: the assigned Front Desk shift shows with its department and resolved time.
  const mondayCard = page.getByTestId(`my-schedule-day-${shiftDate}`);
  await expect(mondayCard).toBeVisible();
  await expect(mondayCard).toContainText('Front Desk');
  await expect(mondayCard).toContainText('08:00–14:00');
  await expect(mondayCard.getByTestId(`my-schedule-off-${shiftDate}`)).not.toBeVisible();

  // Wednesday: no shift and no time off — a clear "Off" state.
  const offCard = page.getByTestId(`my-schedule-day-${offDate}`);
  await expect(offCard.getByTestId(`my-schedule-off-${offDate}`)).toBeVisible();
  await expect(offCard.getByTestId(`my-schedule-timeoff-${offDate}`)).not.toBeVisible();

  // Sunday: approved time off is called out explicitly.
  const timeOffCard = page.getByTestId(`my-schedule-day-${timeOffDate}`);
  await expect(timeOffCard.getByTestId(`my-schedule-timeoff-${timeOffDate}`)).toBeVisible();
  await expect(timeOffCard).toContainText('Approved time off');
  await expect(timeOffCard.getByTestId(`my-schedule-off-${timeOffDate}`)).not.toBeVisible();
});
