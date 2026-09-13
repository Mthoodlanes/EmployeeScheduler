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

async function login(username: string, password: string): Promise<void> {
  await window.getByTestId('login-username').fill(username);
  await window.getByTestId('login-password').fill(password);
  await window.getByTestId('login-submit').click();
}

test('employee self-service: rename their own account and change their own password via My Account', async () => {
  // First-run setup creates the manager account and logs them straight in.
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Create an employee who will exercise the self-service My Account page.
  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Alex Employee');
  await window.locator('#employee-username').fill('alex');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-front_desk').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Alex Employee');

  // Log out and log back in as Alex.
  await window.getByRole('button', { name: 'Log out' }).click();
  await login('alex', 'password123');
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
  await expect(window.locator('.app-nav-user')).toHaveText('Alex Employee (employee)');

  // --- Change display name -------------------------------------------------
  await window.getByRole('link', { name: 'My Account' }).click();
  await expect(window.getByRole('heading', { name: 'My Account' })).toBeVisible();
  await expect(window.getByTestId('my-account-name')).toHaveValue('Alex Employee');

  await window.getByTestId('my-account-name').fill('Alexandra Employee');
  await window.getByTestId('my-account-submit').click();
  await expect(window.getByTestId('my-account-success')).toBeVisible();
  // Reflected immediately in the nav's "name (role)" display, with no reload.
  await expect(window.locator('.app-nav-user')).toHaveText('Alexandra Employee (employee)');

  // --- Wrong current password: rejected, credential unchanged -------------
  await window.getByTestId('my-account-current-password').fill('totally-wrong-password');
  await window.getByTestId('my-account-new-password').fill('new-password-456');
  await window.getByTestId('my-account-confirm-password').fill('new-password-456');
  await window.getByTestId('my-account-submit').click();
  await expect(window.getByTestId('my-account-error')).toBeVisible();
  await expect(window.getByTestId('my-account-success')).toBeHidden();

  // Prove the OLD password still works after the rejected attempt.
  await window.getByRole('button', { name: 'Log out' }).click();
  await login('alex', 'password123');
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // --- Correct current password: password change actually takes effect ---
  await window.getByRole('link', { name: 'My Account' }).click();
  await window.getByTestId('my-account-current-password').fill('password123');
  await window.getByTestId('my-account-new-password').fill('new-password-456');
  await window.getByTestId('my-account-confirm-password').fill('new-password-456');
  await window.getByTestId('my-account-submit').click();
  await expect(window.getByTestId('my-account-success')).toBeVisible();

  // Log out; the OLD password no longer works, the NEW one does.
  await window.getByRole('button', { name: 'Log out' }).click();
  await login('alex', 'password123');
  await expect(window.getByTestId('login-error')).toBeVisible();

  await window.getByTestId('login-username').fill('alex');
  await window.getByTestId('login-password').fill('new-password-456');
  await window.getByTestId('login-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
  await expect(window.locator('.app-nav-user')).toHaveText('Alexandra Employee (employee)');
});
