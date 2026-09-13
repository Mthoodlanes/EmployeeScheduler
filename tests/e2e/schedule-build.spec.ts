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

test('manager builds a schedule across two departments and overrides a shift', async () => {
  // First-run setup creates the manager account and logs them straight in.
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Create an employee who works both Front Desk and Bar shifts.
  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Sam Employee');
  await window.locator('#employee-username').fill('sam');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-front_desk').check();
  await window.locator('#department-bar').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Sam Employee');

  // Create a shift template for Front Desk.
  await window.getByRole('link', { name: 'Shift Templates' }).click();
  await window.locator('#template-name').fill('Front Desk AM');
  await window.locator('#template-start').fill('08:00');
  await window.locator('#template-end').fill('14:00');
  await window.getByRole('button', { name: 'Add template' }).click();
  await expect(window.getByTestId('shift-templates-table')).toContainText('Front Desk AM');

  // Create a shift template for Bar.
  await window.locator('#template-name').fill('Bar Open');
  await window.locator('#template-department').selectOption({ label: 'Bar' });
  await window.locator('#template-start').fill('16:00');
  await window.locator('#template-end').fill('23:00');
  await window.getByRole('button', { name: 'Add template' }).click();
  await expect(window.getByTestId('shift-templates-table')).toContainText('Bar Open');

  // Open the Schedule Board — Front Desk tab is selected by default.
  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  // Assign the Front Desk template to Sam on the first visible day.
  const frontDeskCell = window.locator('[data-testid^="schedule-cell-2-"]').first();
  await frontDeskCell.click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await window.locator('[data-testid^="assign-template-"]').first().click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();
  await expect(window.locator('[data-testid^="shift-card-"]')).toHaveCount(1);

  // Switch to the Bar tab and assign the Bar template to the same employee.
  await window.getByRole('tab', { name: 'Bar' }).click();
  const barCell = window.locator('[data-testid^="schedule-cell-2-"]').first();
  await barCell.click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await window.locator('[data-testid^="assign-template-"]').first().click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();

  const barShiftCard = window.locator('[data-testid^="shift-card-"]').first();
  await expect(barShiftCard).toBeVisible();

  // Override that Bar shift's time and confirm the "edited" indicator appears.
  await barShiftCard.click();
  await expect(window.getByTestId('edit-shift-dialog')).toBeVisible();
  await window.locator('#edit-shift-start').fill('17:00');
  await window.locator('#edit-shift-end').fill('23:00');
  await window.getByTestId('edit-shift-save').click();
  await expect(window.getByTestId('edit-shift-dialog')).toBeHidden();
  await expect(window.locator('[data-testid^="shift-card-edited-"]')).toBeVisible();
});
