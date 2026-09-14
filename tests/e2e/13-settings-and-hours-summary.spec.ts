import { expect, test } from '@playwright/test';
import {
  assignButtonFor,
  datesFromAssignButtons,
  loginAsManager,
  uniqueName,
  uniqueUsername,
} from './helpers.js';

/**
 * Milestone 26: two independently-scoped display features added on top of
 * the completed app rather than a new milestone of their own — a per-device
 * 12-hour/24-hour time format setting, and a per-department "Hours Summary"
 * on the Schedule Board that totals each active hourly employee's scheduled
 * hours for the visible week (skipping salaried staff) so a manager can
 * catch overtime while building the schedule.
 */
test('Settings time-format toggle changes how shift times render', async ({ page }) => {
  await loginAsManager(page);

  const employeeName = uniqueName('Casey Clockwatcher');
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(uniqueUsername('casey'));
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  const cellDates = await datesFromAssignButtons(page, employeeName);
  const shiftDate = cellDates[0];

  await assignButtonFor(page, employeeName, shiftDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-custom').click();
  await page.locator('#assign-custom-start').fill('14:00');
  await page.locator('#assign-custom-end').fill('22:00');
  await page.getByTestId('assign-custom-submit').click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  // Scoped to the on-screen grid, not `page`, since the always-mounted
  // (but print-only, screen-hidden) `PrintSchedule` table renders the exact
  // same shift-time text and would otherwise make these a strict-mode
  // ambiguous match.
  const grid = page.locator('.schedule-grid-wrapper');

  // Default is 24-hour — unchanged from how every screen has always shown times.
  await expect(grid.getByText('14:00–22:00')).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByTestId('settings-time-format').selectOption('12h');

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(grid.getByText('2:00 PM–10:00 PM')).toBeVisible();
  await expect(grid.getByText('14:00–22:00')).toHaveCount(0);

  // Switching back reverts every screen immediately, with no page reload needed.
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('settings-time-format').selectOption('24h');
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(grid.getByText('14:00–22:00')).toBeVisible();
});

test('Hours Summary totals hourly employees, flags overtime, skips salaried staff, and is excluded from print', async ({
  page,
}) => {
  await loginAsManager(page);

  const overtimeEmployeeName = uniqueName('Owen Overtime');
  const normalEmployeeName = uniqueName('Nora Normal');
  const salariedEmployeeName = uniqueName('Sal Salaried');

  await page.getByRole('link', { name: 'Employees' }).click();
  /* eslint-disable no-await-in-loop -- each submission must complete before the next starts, since they share form fields. */
  for (const [index, { name, isSalaried }] of [
    { name: overtimeEmployeeName, isSalaried: false },
    { name: normalEmployeeName, isSalaried: false },
    { name: salariedEmployeeName, isSalaried: true },
  ].entries()) {
    await page.locator('#employee-name').fill(name);
    await page.locator('#employee-username').fill(uniqueUsername(`hrs${index}`));
    await page.locator('#employee-password').fill('password123');
    await page.locator('#department-front_desk').check();
    if (isSalaried) {
      await page.locator('#employee-salaried').check();
    }
    await page.getByRole('button', { name: 'Add employee' }).click();
    await expect(page.getByTestId('employees-table')).toContainText(name);
  }
  /* eslint-enable no-await-in-loop */

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  const overtimeDates = (await datesFromAssignButtons(page, overtimeEmployeeName)).slice(0, 3);
  /* eslint-disable no-await-in-loop -- each assignment must land before the next targets the same dialog. */
  for (const date of overtimeDates) {
    await assignButtonFor(page, overtimeEmployeeName, date).click();
    await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
    await page.getByTestId('assign-mode-custom').click();
    await page.locator('#assign-custom-start').fill('08:00');
    await page.locator('#assign-custom-end').fill('22:00');
    await page.getByTestId('assign-custom-submit').click();
    await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();
  }
  /* eslint-enable no-await-in-loop */
  // 3 x 14h = 42h — past the 40h overtime threshold.

  const normalDate = (await datesFromAssignButtons(page, normalEmployeeName))[0];
  await assignButtonFor(page, normalEmployeeName, normalDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-custom').click();
  await page.locator('#assign-custom-start').fill('09:00');
  await page.locator('#assign-custom-end').fill('17:00');
  await page.getByTestId('assign-custom-submit').click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();
  // A single 8h shift — nowhere near overtime.

  const salariedDate = (await datesFromAssignButtons(page, salariedEmployeeName))[0];
  await assignButtonFor(page, salariedEmployeeName, salariedDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-custom').click();
  await page.locator('#assign-custom-start').fill('09:00');
  await page.locator('#assign-custom-end').fill('21:00');
  await page.getByTestId('assign-custom-submit').click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  const summary = page.getByTestId('hours-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(overtimeEmployeeName);
  await expect(summary).toContainText(normalEmployeeName);
  // Salaried staff are excluded from the summary entirely, regardless of their shifts.
  await expect(summary).not.toContainText(salariedEmployeeName);

  const overtimeRow = summary.locator('tr').filter({ hasText: overtimeEmployeeName });
  await expect(overtimeRow).toContainText('42');
  await expect(overtimeRow).toContainText('Overtime');

  const normalRow = summary.locator('tr').filter({ hasText: normalEmployeeName });
  await expect(normalRow).toContainText('8');
  await expect(normalRow).not.toContainText('Overtime');

  // The physical posting is just the shift grid — the summary is a screen-only aid.
  await page.emulateMedia({ media: 'print' });
  await expect(summary).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
});
