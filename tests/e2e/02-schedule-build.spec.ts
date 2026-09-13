import { expect, test } from '@playwright/test';
import {
  assignButtonFor,
  dayCellFor,
  datesFromAssignButtons,
  loginAsManager,
  uniqueName,
  uniqueUsername,
} from './helpers.js';

/**
 * Milestone 24: ported from the deleted `tests/e2e/schedule-build.spec.ts`
 * (originally `_electron`, one isolated SQLite db per test). Now runs
 * against the shared Neon TEST branch via `loginAsManager()` — every
 * employee/template created here uses `uniqueName()`/`uniqueUsername()` so it
 * can never collide with another spec's data in the same, growing database
 * (see `helpers.ts`'s file header).
 */
test('manager builds a schedule across two departments and overrides a shift', async ({ page }) => {
  await loginAsManager(page);

  const employeeName = uniqueName('Sam Employee');

  // Create an employee who works both Front Desk and Bar shifts.
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(uniqueUsername('sam'));
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.locator('#department-bar').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  const frontDeskTemplateName = uniqueName('Front Desk AM');
  const barTemplateName = uniqueName('Bar Open');

  // Create a shift template for Front Desk.
  await page.getByRole('link', { name: 'Shift Templates' }).click();
  await page.locator('#template-name').fill(frontDeskTemplateName);
  await page.locator('#template-start').fill('08:00');
  await page.locator('#template-end').fill('14:00');
  await page.getByRole('button', { name: 'Add template' }).click();
  await expect(page.getByTestId('shift-templates-table')).toContainText(frontDeskTemplateName);

  // Create a shift template for Bar.
  await page.locator('#template-name').fill(barTemplateName);
  await page.locator('#template-department').selectOption({ label: 'Bar' });
  await page.locator('#template-start').fill('16:00');
  await page.locator('#template-end').fill('23:00');
  await page.getByRole('button', { name: 'Add template' }).click();
  await expect(page.getByTestId('shift-templates-table')).toContainText(barTemplateName);

  // Open the Schedule Board — Front Desk tab is selected by default.
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  // Assign the Front Desk template to Sam on the first visible day.
  const [targetDate] = await datesFromAssignButtons(page, employeeName);
  await assignButtonFor(page, employeeName, targetDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(frontDeskTemplateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();
  await expect(
    dayCellFor(page, employeeName, targetDate).locator('[data-testid^="shift-card-"]'),
  ).toHaveCount(1);

  // Switch to the Bar tab and assign the Bar template to the same employee, same day.
  await page.getByRole('tab', { name: 'Bar' }).click();
  await assignButtonFor(page, employeeName, targetDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(barTemplateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  const barShiftCard = dayCellFor(page, employeeName, targetDate).locator('[data-testid^="shift-card-"]');
  await expect(barShiftCard).toBeVisible();

  // Override that Bar shift's time and confirm the "edited" indicator appears.
  await barShiftCard.click();
  await expect(page.getByTestId('edit-shift-dialog')).toBeVisible();
  await page.locator('#edit-shift-start').fill('17:00');
  await page.locator('#edit-shift-end').fill('23:00');
  await page.getByTestId('edit-shift-save').click();
  await expect(page.getByTestId('edit-shift-dialog')).toBeHidden();
  await expect(
    dayCellFor(page, employeeName, targetDate).locator('[data-testid^="shift-card-edited-"]'),
  ).toBeVisible();
});
