import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  assignButtonFor,
  dayCellFor,
  datesFromAssignButtons,
  loginAsManager,
  uniqueName,
  uniqueUsername,
} from './helpers.js';

/**
 * Milestone 24: ported from the deleted `tests/e2e/overlap-and-preferences.spec.ts`
 * (3 scenarios). Runs against the shared, growing Neon TEST branch — every
 * employee/template is uniquely named, and overlap-banner/preference-indicator
 * assertions are scoped to this spec's own employee (`li`/`dayCellFor` scoping)
 * rather than assuming the banner or a cell is otherwise completely empty, so
 * unrelated data left by other specs can never cause a false failure.
 */
async function addTemplate(
  page: Page,
  department: 'Front Desk' | 'Cafe' | 'Bar',
  name: string,
  start: string,
  end: string,
): Promise<void> {
  await page.locator('#template-name').fill(name);
  await page.locator('#template-department').selectOption({ label: department });
  await page.locator('#template-start').fill(start);
  await page.locator('#template-end').fill(end);
  await page.getByRole('button', { name: 'Add template' }).click();
  await expect(page.getByTestId('shift-templates-table')).toContainText(name);
}

test('cross-department overlap banner appears, updates live, and clears when no longer overlapping', async ({
  page,
}) => {
  await loginAsManager(page);

  const employeeName = uniqueName('Casey Nguyen');

  // An hourly employee who works both Cafe and Bar.
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(uniqueUsername('casey'));
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-cafe').check();
  await page.locator('#department-bar').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  // Templates for Cafe and Bar that will overlap when both assigned the same day.
  const cafeTemplateName = uniqueName('Cafe Morning');
  const barTemplateName = uniqueName('Bar Afternoon');
  await page.getByRole('link', { name: 'Shift Templates' }).click();
  await addTemplate(page, 'Cafe', cafeTemplateName, '09:00', '14:00');
  await addTemplate(page, 'Bar', barTemplateName, '13:00', '18:00');

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  const banner = page.getByTestId('overlap-banner');
  const employeeWarning = banner.locator('li', { hasText: employeeName });
  // No conflict for this employee yet (other specs' unrelated warnings, if
  // any, are not this test's concern).
  await expect(employeeWarning).toHaveCount(0);

  // Assign Cafe Morning on the Cafe tab.
  await page.getByRole('tab', { name: 'Cafe' }).click();
  const [targetDate] = await datesFromAssignButtons(page, employeeName);
  await assignButtonFor(page, employeeName, targetDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(cafeTemplateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  // Assign Bar Afternoon on the same day, on the Bar tab -> now overlapping.
  await page.getByRole('tab', { name: 'Bar' }).click();
  await assignButtonFor(page, employeeName, targetDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(barTemplateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  // Banner should appear live, naming both departments, without any manual refresh.
  await expect(employeeWarning).toBeVisible();
  await expect(employeeWarning).toContainText('Cafe');
  await expect(employeeWarning).toContainText('Bar');

  // Still visible from a department not involved in the conflict at all.
  await page.getByRole('tab', { name: 'Front Desk' }).click();
  await expect(employeeWarning).toBeVisible();

  // Edit the Bar shift so it no longer overlaps -> banner clears live.
  await page.getByRole('tab', { name: 'Bar' }).click();
  const barShiftCard = dayCellFor(page, employeeName, targetDate).locator('[data-testid^="shift-card-"]');
  await barShiftCard.click();
  await expect(page.getByTestId('edit-shift-dialog')).toBeVisible();
  await page.locator('#edit-shift-start').fill('14:00');
  await page.locator('#edit-shift-end').fill('20:00');
  await page.getByTestId('edit-shift-save').click();
  await expect(page.getByTestId('edit-shift-dialog')).toBeHidden();

  await expect(employeeWarning).toHaveCount(0);
});

test('a salaried employee scheduled into overlapping shifts produces no banner entry and shows the Flexible tag', async ({
  page,
}) => {
  await loginAsManager(page);

  const employeeName = uniqueName('Jordan Blake');

  // A salaried employee who works both Cafe and Bar (mirrors seed's "jordan").
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(uniqueUsername('jordan'));
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-cafe').check();
  await page.locator('#department-bar').check();
  await page.locator('#employee-salaried').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  const cafeTemplateName = uniqueName('Cafe Morning');
  const barTemplateName = uniqueName('Bar Afternoon');
  await page.getByRole('link', { name: 'Shift Templates' }).click();
  await addTemplate(page, 'Cafe', cafeTemplateName, '09:00', '15:00');
  await addTemplate(page, 'Bar', barTemplateName, '10:00', '20:00');

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await page.getByRole('tab', { name: 'Cafe' }).click();
  const [targetDate] = await datesFromAssignButtons(page, employeeName);
  await assignButtonFor(page, employeeName, targetDate).click();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(cafeTemplateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  await page.getByRole('tab', { name: 'Bar' }).click();
  await assignButtonFor(page, employeeName, targetDate).click();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(barTemplateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  // Clearly overlapping (09-15 and 10-20), but Jordan is salaried -> no banner entry at all.
  const banner = page.getByTestId('overlap-banner');
  await expect(banner.locator('li', { hasText: employeeName })).toHaveCount(0);

  // Both shift cards show the Flexible tag.
  await expect(dayCellFor(page, employeeName, targetDate).getByTestId('salaried-tag')).toBeVisible();
  await page.getByRole('tab', { name: 'Cafe' }).click();
  await expect(dayCellFor(page, employeeName, targetDate).getByTestId('salaried-tag')).toBeVisible();
});

test('manager-entered preference windows are reflected as a soft indicator on matching vs conflicting shifts', async ({
  page,
}) => {
  await loginAsManager(page);

  const employeeName = uniqueName('Alex Chen');

  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(uniqueUsername('alexchen'));
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  // Edit the employee to open the preferences panel and add a morning preference window.
  const employeeRow = page.locator('tr', { hasText: employeeName });
  await employeeRow.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByTestId('preferences-panel')).toBeVisible();

  await page.locator('#preference-day').selectOption({ label: 'Monday' });
  await page.locator('#preference-start').fill('08:00');
  await page.locator('#preference-end').fill('12:00');
  await page.getByRole('button', { name: 'Add preference' }).click();
  await expect(page.getByTestId('preferences-table')).toContainText('Monday');

  // Two Front Desk templates: one within the preferred window, one outside it.
  const morningTemplateName = uniqueName('Front Desk Morning');
  const eveningTemplateName = uniqueName('Front Desk Evening');
  await page.getByRole('link', { name: 'Shift Templates' }).click();
  await addTemplate(page, 'Front Desk', morningTemplateName, '08:00', '12:00');
  await addTemplate(page, 'Front Desk', eveningTemplateName, '17:00', '22:00');

  // Find the next Monday from today so the assigned shifts land on a day the
  // preference actually applies to.
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  const dates = await datesFromAssignButtons(page, employeeName);
  const mondayDate = dates.find((date) => new Date(`${date}T00:00:00Z`).getUTCDay() === 1);
  expect(mondayDate).not.toBeUndefined();
  const monday = mondayDate as string;

  // Assign the matching-preference template on Monday.
  await assignButtonFor(page, employeeName, monday).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(morningTemplateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  const dayCell = dayCellFor(page, employeeName, monday);
  const matchingIndicator = dayCell.getByTestId('preference-indicator').first();
  await expect(matchingIndicator).toHaveAttribute('data-preference-result', 'matches');

  // Assign the conflicting-with-preference template on the same day.
  await assignButtonFor(page, employeeName, monday).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(eveningTemplateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  const indicators = dayCell.getByTestId('preference-indicator');
  await expect(indicators).toHaveCount(2);
  const results = await indicators.evaluateAll((elements) =>
    elements.map((el) => el.getAttribute('data-preference-result')),
  );
  expect(results.sort()).toEqual(['matches', 'outside']);
});
