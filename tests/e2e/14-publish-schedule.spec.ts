import { expect, test } from '@playwright/test';
import {
  assignButtonFor,
  datesFromAssignButtons,
  login,
  loginAsManager,
  logout,
  uniqueName,
  uniqueUsername,
} from './helpers.js';

/**
 * Covers the Schedule Board's "Publish Schedule" gate: a department's week
 * stays off an employee's "My Schedule" until a manager publishes it, and
 * unpublishing hides it again. Uses the Mechanic tab specifically — every
 * other spec in this shared, growing test database only ever touches Front
 * Desk/Bar/Cafe, so Mechanic's publication state can never have been
 * mutated by an earlier spec in the same run (see `helpers.ts`'s file header
 * on why specs must avoid assuming anything about shared state they didn't
 * create themselves).
 */
test('publishing and unpublishing a department week gates its visibility on My Schedule', async ({
  page,
}) => {
  await loginAsManager(page);

  const employeeName = uniqueName('Morgan Mechanic');
  const username = uniqueUsername('morgan');

  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(username);
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-mechanic').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  const templateName = uniqueName('Mechanic Shift');
  await page.getByRole('link', { name: 'Shift Templates' }).click();
  await page.locator('#template-name').fill(templateName);
  await page.locator('#template-department').selectOption({ label: 'Mechanic' });
  await page.locator('#template-start').fill('09:00');
  await page.locator('#template-end').fill('17:00');
  await page.getByRole('button', { name: 'Add template' }).click();
  await expect(page.getByTestId('shift-templates-table')).toContainText(templateName);

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await page.getByRole('tab', { name: 'Mechanic' }).click();

  // Starts unpublished — no earlier spec ever touches the Mechanic tab.
  await expect(page.getByTestId('publish-status-tag')).toHaveText('Not published');
  await expect(page.getByTestId('publish-schedule-button')).toBeVisible();
  await expect(page.getByTestId('unpublish-schedule-button')).not.toBeVisible();

  const [shiftDate] = await datesFromAssignButtons(page, employeeName);
  await assignButtonFor(page, employeeName, shiftDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(templateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  // Not published yet — the employee sees no shift on My Schedule.
  await logout(page);
  await login(page, username, 'password123');
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
  await expect(page.getByTestId(`my-schedule-off-${shiftDate}`)).toBeVisible();

  // Manager publishes the Mechanic week.
  await logout(page);
  await loginAsManager(page);
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await page.getByRole('tab', { name: 'Mechanic' }).click();
  await page.getByTestId('publish-schedule-button').click();
  await expect(page.getByTestId('publish-status-tag')).toHaveText('Published');
  await expect(page.getByTestId('unpublish-schedule-button')).toBeVisible();
  await expect(page.getByTestId('publish-schedule-button')).not.toBeVisible();

  // Now published — the employee sees the shift.
  await logout(page);
  await login(page, username, 'password123');
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
  const shiftCard = page.getByTestId(`my-schedule-day-${shiftDate}`);
  await expect(shiftCard).toContainText('Mechanic');
  await expect(shiftCard).toContainText('09:00–17:00');
  await expect(page.getByTestId(`my-schedule-off-${shiftDate}`)).not.toBeVisible();

  // Manager unpublishes it again.
  await logout(page);
  await loginAsManager(page);
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await page.getByRole('tab', { name: 'Mechanic' }).click();
  await page.getByTestId('unpublish-schedule-button').click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-dialog-confirm').click();
  await expect(page.getByTestId('publish-status-tag')).toHaveText('Not published');

  // Hidden from the employee again.
  await logout(page);
  await login(page, username, 'password123');
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
  await expect(page.getByTestId(`my-schedule-off-${shiftDate}`)).toBeVisible();
});
