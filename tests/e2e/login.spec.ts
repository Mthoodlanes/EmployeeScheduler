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
  // Give each test run a fresh, isolated userData dir so the app always
  // starts in "first run" state, regardless of what's in the developer's
  // real app data.
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

test('first-run setup creates a manager, then logout/login and invalid login are handled', async () => {
  // First run: the setup form should appear (employees table is empty).
  await expect(window.getByTestId('first-run-name')).toBeVisible();

  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();

  // Setup logs the new manager straight in.
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Log out and confirm the login screen appears.
  await window.getByRole('button', { name: 'Log out' }).click();
  await expect(window.getByTestId('login-username')).toBeVisible();

  // Log back in with the account just created.
  await window.getByTestId('login-username').fill('dana');
  await window.getByTestId('login-password').fill('supersecret1');
  await window.getByTestId('login-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Log out once more and try an invalid password.
  await window.getByRole('button', { name: 'Log out' }).click();
  await window.getByTestId('login-username').fill('dana');
  await window.getByTestId('login-password').fill('totally-wrong');
  await window.getByTestId('login-submit').click();

  await expect(window.getByTestId('login-error')).toBeVisible();
  await expect(window.getByTestId('login-error')).toHaveText(/invalid/i);
});
