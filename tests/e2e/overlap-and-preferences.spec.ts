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

test.beforeEach(async () => {
  // Fresh, isolated userData dir per test so the app always starts in
  // "first run" state, regardless of what's in the developer's real app data.
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

async function firstRunSetup(): Promise<void> {
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
}

async function addTemplate(
  department: 'Front Desk' | 'Cafe' | 'Bar',
  name: string,
  start: string,
  end: string,
): Promise<void> {
  await window.locator('#template-name').fill(name);
  await window.locator('#template-department').selectOption({ label: department });
  await window.locator('#template-start').fill(start);
  await window.locator('#template-end').fill(end);
  await window.getByRole('button', { name: 'Add template' }).click();
  await expect(window.getByTestId('shift-templates-table')).toContainText(name);
}

test('cross-department overlap banner appears, updates live, and clears when no longer overlapping', async () => {
  await firstRunSetup();

  // An hourly employee who works both Cafe and Bar.
  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Casey Nguyen');
  await window.locator('#employee-username').fill('casey');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-cafe').check();
  await window.locator('#department-bar').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Casey Nguyen');

  // Templates for Cafe and Bar that will overlap when both assigned the same day.
  await window.getByRole('link', { name: 'Shift Templates' }).click();
  await addTemplate('Cafe', 'Cafe Morning', '09:00', '14:00');
  await addTemplate('Bar', 'Bar Afternoon', '13:00', '18:00');

  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  // No conflicts yet.
  await expect(window.getByTestId('overlap-banner')).toHaveCount(0);

  // Assign Cafe Morning on Cafe tab (Casey is employee id 2 — the first employee created after the manager).
  await window.getByRole('tab', { name: 'Cafe' }).click();
  const cafeCell = window.locator('[data-testid^="schedule-cell-2-"]').first();
  const targetDate = (await cafeCell.getAttribute('data-testid'))!.replace('schedule-cell-2-', '');
  await cafeCell.click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await window.locator('[data-testid^="assign-template-"]').first().click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();

  // Assign Bar Afternoon on the same day, on the Bar tab -> now overlapping.
  await window.getByRole('tab', { name: 'Bar' }).click();
  await window.getByTestId(`schedule-cell-2-${targetDate}`).click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await window.locator('[data-testid^="assign-template-"]').first().click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();

  // Banner should appear live, naming both departments, without any manual refresh.
  const banner = window.getByTestId('overlap-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Casey Nguyen');
  await expect(banner).toContainText('Cafe');
  await expect(banner).toContainText('Bar');

  // The banner is visible from the Bar tab too even though it was reached by
  // assigning here — it should remain visible when we switch to Front Desk,
  // a department not involved in the conflict at all.
  await window.getByRole('tab', { name: 'Front Desk' }).click();
  await expect(banner).toBeVisible();

  // Edit the Bar shift so it no longer overlaps -> banner clears live.
  await window.getByRole('tab', { name: 'Bar' }).click();
  const barShiftCard = window.locator('[data-testid^="shift-card-"]').first();
  await barShiftCard.click();
  await expect(window.getByTestId('edit-shift-dialog')).toBeVisible();
  await window.locator('#edit-shift-start').fill('14:00');
  await window.locator('#edit-shift-end').fill('20:00');
  await window.getByTestId('edit-shift-save').click();
  await expect(window.getByTestId('edit-shift-dialog')).toBeHidden();

  await expect(window.getByTestId('overlap-banner')).toHaveCount(0);
});

test('a salaried employee scheduled into overlapping shifts produces no banner entry and shows the Flexible tag', async () => {
  await firstRunSetup();

  // A salaried employee who works both Cafe and Bar (mirrors seed's "jordan").
  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Jordan Blake');
  await window.locator('#employee-username').fill('jordan');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-cafe').check();
  await window.locator('#department-bar').check();
  await window.locator('#employee-salaried').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Jordan Blake');

  await window.getByRole('link', { name: 'Shift Templates' }).click();
  await addTemplate('Cafe', 'Cafe Morning', '09:00', '15:00');
  await addTemplate('Bar', 'Bar Afternoon', '10:00', '20:00');

  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await window.getByRole('tab', { name: 'Cafe' }).click();
  const cafeCell = window.locator('[data-testid^="schedule-cell-2-"]').first();
  const targetDate = (await cafeCell.getAttribute('data-testid'))!.replace('schedule-cell-2-', '');
  await cafeCell.click();
  await window.locator('[data-testid^="assign-template-"]').first().click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();

  await window.getByRole('tab', { name: 'Bar' }).click();
  await window.getByTestId(`schedule-cell-2-${targetDate}`).click();
  await window.locator('[data-testid^="assign-template-"]').first().click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();

  // Clearly overlapping (09-15 and 10-20), but Jordan is salaried -> no banner entry at all.
  await expect(window.getByTestId('overlap-banner')).toHaveCount(0);

  // Both shift cards show the Flexible tag.
  await expect(window.getByTestId('salaried-tag')).toBeVisible();
  await window.getByRole('tab', { name: 'Cafe' }).click();
  await expect(window.getByTestId('salaried-tag')).toBeVisible();
});

test('manager-entered preference windows are reflected as a soft indicator on matching vs conflicting shifts', async () => {
  await firstRunSetup();

  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Alex Chen');
  await window.locator('#employee-username').fill('alex');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-front_desk').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Alex Chen');

  // Edit Alex to open the preferences panel and add a morning preference window.
  await window.locator('#employee-name').waitFor();
  const employeeRow = window.locator('tr', { hasText: 'Alex Chen' });
  await employeeRow.getByRole('button', { name: 'Edit' }).click();
  await expect(window.getByTestId('preferences-panel')).toBeVisible();

  await window.locator('#preference-day').selectOption({ label: 'Monday' });
  await window.locator('#preference-start').fill('08:00');
  await window.locator('#preference-end').fill('12:00');
  await window.getByRole('button', { name: 'Add preference' }).click();
  await expect(window.getByTestId('preferences-table')).toContainText('Monday');

  // Two Front Desk templates: one within the preferred window, one outside it.
  await window.getByRole('link', { name: 'Shift Templates' }).click();
  await addTemplate('Front Desk', 'Front Desk Morning', '08:00', '12:00');
  await addTemplate('Front Desk', 'Front Desk Evening', '17:00', '22:00');

  // Find the next Monday from today so the assigned shifts land on a day the
  // preference actually applies to.
  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  const cells = window.locator('[data-testid^="schedule-cell-2-"]');
  const testIds = await cells.evaluateAll((elements) =>
    elements.map((el) => el.getAttribute('data-testid') ?? ''),
  );
  const dates = testIds.map((testId) => testId.replace('schedule-cell-2-', ''));
  const mondayDate = dates.find((date) => new Date(`${date}T00:00:00Z`).getUTCDay() === 1) ?? null;
  expect(mondayDate).not.toBeNull();

  // Assign the matching-preference template on Monday.
  await window.getByTestId(`schedule-cell-2-${mondayDate}`).click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await window.getByText('Front Desk Morning').click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();

  const matchingIndicator = window.getByTestId('preference-indicator').first();
  await expect(matchingIndicator).toHaveAttribute('data-preference-result', 'matches');

  // Assign the conflicting-with-preference template on the same day.
  await window.getByTestId(`schedule-cell-2-${mondayDate}`).click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await window.getByText('Front Desk Evening').click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();

  const indicators = window.getByTestId('preference-indicator');
  await expect(indicators).toHaveCount(2);
  const results = await indicators.evaluateAll((elements) =>
    elements.map((el) => el.getAttribute('data-preference-result')),
  );
  expect(results.sort()).toEqual(['matches', 'outside']);
});
