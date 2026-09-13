import { expect, test } from '@playwright/test';
import { MANAGER_NAME, MANAGER_PASSWORD, MANAGER_USERNAME } from './testAccounts.js';
import { login } from './helpers.js';

/**
 * Milestone 24: ported from the deleted `tests/e2e/login.spec.ts` (originally
 * `_electron`, one isolated SQLite db per test via `--user-data-dir`). Now
 * runs against the shared Neon TEST branch, which `global-setup.ts` truncates
 * to genuinely empty once for the whole run — this is deliberately the FIRST
 * spec to run (see the numeric filename prefix scheme explained in
 * `testAccounts.ts`), since it performs the actual first-run signup that
 * creates the ONE manager account every other spec in the suite logs in as.
 */
test('first-run setup creates a manager, then logout/login and invalid login are handled', async ({
  page,
}) => {
  await page.goto('/');

  // First run: the setup form should appear (employees table is empty).
  await expect(page.getByTestId('first-run-name')).toBeVisible();

  await page.getByTestId('first-run-name').fill(MANAGER_NAME);
  await page.getByTestId('first-run-username').fill(MANAGER_USERNAME);
  await page.getByTestId('first-run-password').fill(MANAGER_PASSWORD);
  await page.getByTestId('first-run-confirm-password').fill(MANAGER_PASSWORD);
  await page.getByTestId('first-run-submit').click();

  // Setup logs the new manager straight in.
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Log out and confirm the login screen appears.
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByTestId('login-username')).toBeVisible();

  // Log back in with the account just created.
  await login(page, MANAGER_USERNAME, MANAGER_PASSWORD);
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Log out once more and try an invalid password.
  await page.getByRole('button', { name: 'Log out' }).click();
  await login(page, MANAGER_USERNAME, 'totally-wrong');

  await expect(page.getByTestId('login-error')).toBeVisible();
  await expect(page.getByTestId('login-error')).toHaveText(/invalid/i);
});
