import { expect, test } from '@playwright/test';
import { assignButtonFor, dayCellFor, loginAsManager, login, logout, uniqueName, uniqueUsername } from './helpers.js';

/**
 * Milestone 24: ported from the deleted `tests/e2e/unavailability.spec.ts`.
 * Queue-row assertions are scoped via `page.locator('tr', { hasText: employeeName })`
 * rather than the original's "the whole pending table is empty" check
 * (`getByText('No requests to show')`) — with a shared, growing database that
 * a manager-submit-on-behalf request never appears under Pending is proven by
 * checking THIS employee's row is absent from the currently-filtered table,
 * which holds regardless of what other specs left behind.
 */
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

test('employee submits unavailability, manager approves it and sees the panel/warning on the grid; manager-submit-on-behalf auto-approves time off', async ({
  page,
}) => {
  await loginAsManager(page);

  const employeeName = uniqueName('Alex Employee');
  const username = uniqueUsername('alex');

  // Create an employee (Front Desk) who will submit unavailability.
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(username);
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  // A Front Desk shift template so the assign-shift dialog has something to pick.
  const templateName = uniqueName('Front Desk AM');
  await page.getByRole('link', { name: 'Shift Templates' }).click();
  await page.locator('#template-name').fill(templateName);
  await page.locator('#template-start').fill('08:00');
  await page.locator('#template-end').fill('14:00');
  await page.getByRole('button', { name: 'Add template' }).click();
  await expect(page.getByTestId('shift-templates-table')).toContainText(templateName);

  // --- Manager-submit-on-behalf (time off): created already-approved. ---
  await page.getByRole('link', { name: 'Request Time Off' }).click();
  await page.locator('#timeoff-on-behalf-of').selectOption({ label: employeeName });
  await page.locator('#timeoff-start').fill(onBehalfTimeOffDate);
  await page.locator('#timeoff-end').fill(onBehalfTimeOffDate);
  await page.locator('#timeoff-reason').fill("Can't submit it themselves");
  await page.getByTestId('timeoff-submit').click();

  await page.getByRole('link', { name: 'Time Off Queue' }).click();
  await expect(page.getByRole('heading', { name: 'Time Off Queue' })).toBeVisible();
  // It never appears under the default "Pending" filter — no separate approval step.
  await expect(page.locator('tr', { hasText: employeeName })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Approved' }).click();
  await expect(page.locator('tr', { hasText: employeeName })).toContainText('approved');

  // Log out and log back in as the employee.
  await logout(page);
  await login(page, username, 'password123');
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Submits recurring unavailability: unavailable all day Sunday.
  await page.getByRole('link', { name: 'Request Time Off' }).click();
  await page.locator('#unavailability-day').selectOption({ label: 'Sunday' });
  await page.locator('#unavailability-full-day').check();
  await page.locator('#unavailability-reason').fill('Family commitments');
  await page.getByTestId('unavailability-submit').click();
  await expect(page.getByTestId('my-unavailability-table')).toContainText('Sunday');
  await expect(page.getByTestId('my-unavailability-table')).toContainText('pending');

  // Log out and log back in as the manager.
  await logout(page);
  await loginAsManager(page);

  // Manager reviews and approves the unavailability request in its own queue tab.
  await page.getByRole('link', { name: 'Time Off Queue' }).click();
  await page.getByRole('tab', { name: 'Unavailability' }).click();
  const unavailabilityRow = page.locator('tr', { hasText: employeeName });
  await expect(unavailabilityRow).toContainText('Sunday');
  await unavailabilityRow.locator('[data-testid^="unavailability-approve-"]').click();
  // Approved requests move out of the default "Pending" filter.
  await expect(page.locator('tr', { hasText: employeeName })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Approved' }).click();
  await expect(page.locator('tr', { hasText: employeeName })).toContainText('approved');

  // Schedule Board: open the assign dialog for the employee on this week's
  // Sunday — the informational unavailability panel should show up ahead of
  // any conflict.
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await assignButtonFor(page, employeeName, sundayDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await expect(page.getByTestId('unavailability-panel')).toBeVisible();
  await expect(page.getByTestId('unavailability-panel')).toContainText('All day');

  // Attempting to actually assign a shift that overlaps it shows the
  // warn/confirm interstitial, mirroring the approved-time-off pattern.
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(templateName, { exact: true }).click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await expect(page.getByTestId('confirm-dialog')).toContainText('overlaps stated unavailability');
  await page.getByTestId('confirm-dialog-confirm').click();
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();
  await expect(
    dayCellFor(page, employeeName, sundayDate).locator('[data-testid^="shift-card-"]'),
  ).toHaveCount(1);
});
