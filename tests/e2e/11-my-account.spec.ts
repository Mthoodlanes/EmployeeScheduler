import { expect, test } from '@playwright/test';
import { login, loginAsManager, logout, uniqueName, uniqueUsername } from './helpers.js';

/**
 * Milestone 24: ported from the deleted `tests/e2e/my-account.spec.ts`. The
 * only adaptation is a uniquely-named/uniquely-usernamed employee, and using
 * the shared `login`/`logout` helpers instead of a local `login()` closure —
 * this scenario is otherwise entirely self-contained (one employee acting on
 * their own account), so no other data-scoping concerns apply.
 */
test('employee self-service: rename their own account and change their own password via My Account', async ({
  page,
}) => {
  await loginAsManager(page);

  const originalName = uniqueName('Alex Employee');
  const renamedName = `${originalName} (renamed)`;
  const username = uniqueUsername('alex');

  // Create an employee who will exercise the self-service My Account page.
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(originalName);
  await page.locator('#employee-username').fill(username);
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(originalName);

  // Log out and log back in as the employee.
  await logout(page);
  await login(page, username, 'password123');
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
  await expect(page.locator('.app-nav-user')).toHaveText(`${originalName} (employee)`);

  // --- Change display name -------------------------------------------------
  await page.getByRole('link', { name: 'My Account' }).click();
  await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible();
  await expect(page.getByTestId('my-account-name')).toHaveValue(originalName);

  await page.getByTestId('my-account-name').fill(renamedName);
  await page.getByTestId('my-account-submit').click();
  await expect(page.getByTestId('my-account-success')).toBeVisible();
  // Reflected immediately in the nav's "name (role)" display, with no reload.
  await expect(page.locator('.app-nav-user')).toHaveText(`${renamedName} (employee)`);

  // --- Wrong current password: rejected, credential unchanged -------------
  await page.getByTestId('my-account-current-password').fill('totally-wrong-password');
  await page.getByTestId('my-account-new-password').fill('new-password-456');
  await page.getByTestId('my-account-confirm-password').fill('new-password-456');
  await page.getByTestId('my-account-submit').click();
  await expect(page.getByTestId('my-account-error')).toBeVisible();
  await expect(page.getByTestId('my-account-success')).toBeHidden();

  // Prove the OLD password still works after the rejected attempt.
  await logout(page);
  await login(page, username, 'password123');
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // --- Correct current password: password change actually takes effect ---
  await page.getByRole('link', { name: 'My Account' }).click();
  await page.getByTestId('my-account-current-password').fill('password123');
  await page.getByTestId('my-account-new-password').fill('new-password-456');
  await page.getByTestId('my-account-confirm-password').fill('new-password-456');
  await page.getByTestId('my-account-submit').click();
  await expect(page.getByTestId('my-account-success')).toBeVisible();

  // Log out; the OLD password no longer works, the NEW one does.
  await logout(page);
  await login(page, username, 'password123');
  await expect(page.getByTestId('login-error')).toBeVisible();

  await login(page, username, 'new-password-456');
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
  await expect(page.locator('.app-nav-user')).toHaveText(`${renamedName} (employee)`);
});
