import { expect, test } from '@playwright/test';
import { assignButtonFor, dayCellFor, loginAsManager, login, logout, uniqueName, uniqueUsername } from './helpers.js';

/**
 * Milestone 24: ported from the deleted `tests/e2e/timeoff-approval.spec.ts`.
 * Runs against the shared Neon TEST branch — the employee is uniquely named
 * so its rows in the (shared, growing) time-off queue table can never be
 * confused with another spec's, and the blocked/warn checks on the Schedule
 * Board are scoped via `dayCellFor` rather than an assumed employee id.
 */
function isoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Time off submitted for today so it always falls inside the schedule grid's
// default visible week (which is the week containing today).
const blockedDate = isoDate(0);
const secondRequestDate = isoDate(3);

test('employee requests time off, manager approves it, the grid blocks the day and warns on scheduling over it; a second request can be denied with a note', async ({
  page,
}) => {
  await loginAsManager(page);

  const employeeName = uniqueName('Alex Employee');
  const username = uniqueUsername('alex');

  // Create an employee (Front Desk) who will request time off.
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(username);
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  // Log out and log back in as the new employee.
  await logout(page);
  await login(page, username, 'password123');
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Submit a time-off request for today (so it lands in the grid's default week).
  await page.getByRole('link', { name: 'Request Time Off' }).click();
  await page.locator('#timeoff-start').fill(blockedDate);
  await page.locator('#timeoff-end').fill(blockedDate);
  await page.locator('#timeoff-reason').fill('Family trip');
  await page.getByTestId('timeoff-submit').click();
  await expect(page.getByTestId('my-timeoff-table')).toContainText('pending');

  // Submit a second request (a different date) that the manager will deny later.
  await page.locator('#timeoff-start').fill(secondRequestDate);
  await page.locator('#timeoff-end').fill(secondRequestDate);
  await page.locator('#timeoff-reason').fill('Concert');
  await page.getByTestId('timeoff-submit').click();
  await expect(page.getByTestId('my-timeoff-table')).toContainText('Concert');

  // Log out and log back in as the manager.
  await logout(page);
  await loginAsManager(page);

  // Manager sees both pending requests in the queue and approves the "Family trip" one.
  await page.getByRole('link', { name: 'Time Off Queue' }).click();
  await expect(page.getByRole('heading', { name: 'Time Off Queue' })).toBeVisible();
  const queueTable = page.getByTestId('timeoff-queue-table');
  await expect(queueTable).toContainText(employeeName);
  await expect(queueTable).toContainText('Family trip');
  await expect(queueTable).toContainText('Concert');

  const familyTripRow = page.locator('tr', { hasText: 'Family trip' });
  await familyTripRow.getByTestId(/^timeoff-approve-/).click();

  // Approved requests move out of the default "Pending" filter.
  await expect(page.getByTestId('timeoff-queue-table')).not.toContainText('Family trip');
  await page.getByRole('tab', { name: 'Approved' }).click();
  await expect(page.getByTestId('timeoff-queue-table')).toContainText('Family trip');
  await expect(page.getByTestId('timeoff-queue-table')).toContainText('approved');

  // Deny the second ("Concert") request with a decision note.
  await page.getByRole('tab', { name: 'Pending' }).click();
  const concertRow = page.locator('tr', { hasText: 'Concert' });
  await concertRow.getByTestId(/^timeoff-deny-/).click();
  await expect(page.getByTestId('deny-timeoff-dialog')).toBeVisible();
  await page.locator('#deny-timeoff-note').fill('Short-staffed that week');
  await page.getByTestId('deny-timeoff-confirm').click();
  await expect(page.getByTestId('deny-timeoff-dialog')).toBeHidden();

  await page.getByRole('tab', { name: 'Denied' }).click();
  await expect(page.getByTestId('timeoff-queue-table')).toContainText('Concert');
  await expect(page.getByTestId('timeoff-queue-table')).toContainText('Short-staffed that week');

  // Schedule Board: the employee's cell for the approved date should now render as blocked.
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  const blockedCell = dayCellFor(page, employeeName, blockedDate);
  await expect(blockedCell).toContainText('Time Off');

  // Attempting to assign a shift on that blocked day shows a confirm interstitial.
  await assignButtonFor(page, employeeName, blockedDate).click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await expect(page.getByTestId('confirm-dialog')).toContainText('approved time off');
  // Cancel rather than confirm: proves the warning appears without needing a
  // shift template to exist yet.
  await page.getByTestId('confirm-dialog-cancel').click();
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();
});
