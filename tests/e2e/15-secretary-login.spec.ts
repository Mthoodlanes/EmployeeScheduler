import { expect, test } from '@playwright/test';
import { loginAsManager, uniqueName, uniqueUsername } from './helpers.js';

/**
 * Milestone 1 of the Secretary Apps (Bowling Dues Tracker) rebuild — proves
 * the dedicated login door, role guard, and layout all work end to end
 * before any real dues-tracker page exists behind them. See the plan's
 * "Secretary Apps: Bowling Dues Tracker" section for the full design: a
 * Secretary account is a real `employees` row (reuses the exact same
 * password hashing / JWT session machinery), reached ONLY through
 * `/secretary/login` — never the normal `/login` — and never seeing the
 * normal scheduling nav. A manager also has full access to the Secretary
 * area (they already have authority over everything else in the app), via
 * either door, without needing a separate account.
 */
test('the Secretary door leads to the Secretary area for Secretary and manager accounts only', async ({
  page,
}) => {
  await loginAsManager(page);

  const secretaryName = uniqueName('Sasha Secretary');
  const secretaryUsername = uniqueUsername('sasha');
  const secretaryPassword = 'password123';
  const employeeName = uniqueName('Eddie Employee');
  const employeeUsername = uniqueUsername('eddie');
  const employeePassword = 'password123';

  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(secretaryName);
  await page.locator('#employee-username').fill(secretaryUsername);
  await page.locator('#employee-password').fill(secretaryPassword);
  await page.locator('#employee-role').selectOption('secretary');
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(secretaryName);

  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(employeeUsername);
  await page.locator('#employee-password').fill(employeePassword);
  await page.locator('#employee-role').selectOption('employee');
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  // A manager already logged into the normal app can reach the Secretary
  // area directly via its own nav link — no separate login needed.
  await page.getByRole('link', { name: 'Secretary Apps' }).click();
  await expect(page.getByRole('heading', { name: 'Leagues' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Secretary Sign In' })).toBeVisible();

  // A manager can also use the dedicated Secretary door directly.
  await page.getByTestId('secretary-login-username').fill('dana');
  await page.getByTestId('secretary-login-password').fill('supersecret1');
  await page.getByTestId('secretary-login-submit').click();
  await expect(page.getByRole('heading', { name: 'Leagues' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Secretary Sign In' })).toBeVisible();

  // A plain employee (neither Secretary nor manager) is rejected at that
  // same door, not let in.
  await page.getByTestId('secretary-login-username').fill(employeeUsername);
  await page.getByTestId('secretary-login-password').fill(employeePassword);
  await page.getByTestId('secretary-login-submit').click();
  await expect(page.getByTestId('secretary-login-error')).toHaveText(
    /Secretary accounts only/i,
  );
  await expect(page.getByRole('heading', { name: 'Secretary Sign In' })).toBeVisible();

  // The real Secretary account succeeds through this same door and lands
  // on its own area.
  await page.getByTestId('secretary-login-username').fill(secretaryUsername);
  await page.getByTestId('secretary-login-password').fill(secretaryPassword);
  await page.getByTestId('secretary-login-submit').click();
  await expect(page.getByRole('heading', { name: 'Leagues' })).toBeVisible();
  // No scheduling nav at all — a Secretary never sees My Schedule, Time Off, etc.
  await expect(page.getByRole('link', { name: 'My Schedule' })).toHaveCount(0);

  // A Secretary account is bounced straight back out of the normal
  // scheduling app if it tries to reach it directly.
  await page.goto('/#/my-schedule');
  await expect(page.getByRole('heading', { name: 'Leagues' })).toBeVisible();

  // Logging out from the Secretary area lands back on its own login door,
  // not the normal one.
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Secretary Sign In' })).toBeVisible();

  // The normal login door is permissive for a Secretary account too — it
  // just redirects onward to /secretary instead of the scheduling app,
  // rather than rejecting the login outright.
  await page.getByTestId('secretary-login-back').click();
  await expect(page.getByRole('heading', { name: 'Employee Portal' })).toBeVisible();
  await page.getByTestId('login-username').fill(secretaryUsername);
  await page.getByTestId('login-password').fill(secretaryPassword);
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'Leagues' })).toBeVisible();
  // A plain role === 'secretary' account has nowhere else to go — no
  // "Back to Scheduling" link, since RequireAuth would just bounce it
  // straight back here anyway.
  await expect(page.getByRole('link', { name: 'Back to Scheduling' })).toHaveCount(0);
});

test('the Secretary Tag grants access on top of a real role, without replacing it', async ({
  page,
}) => {
  await loginAsManager(page);

  const coordinatorName = uniqueName('Casey Coordinator');
  const coordinatorUsername = uniqueUsername('casey');
  const coordinatorPassword = 'password123';

  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(coordinatorName);
  await page.locator('#employee-username').fill(coordinatorUsername);
  await page.locator('#employee-password').fill(coordinatorPassword);
  await page.locator('#employee-role').selectOption('coordinator');
  await page.locator('#employee-secretary-tagged').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(coordinatorName);

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByTestId('login-username')).toBeVisible();

  // Signs in through the NORMAL door (not /secretary/login) and lands in
  // the normal app first — the tag adds access, it doesn't redirect their
  // primary landing away from their real role.
  await page.getByTestId('login-username').fill(coordinatorUsername);
  await page.getByTestId('login-password').fill(coordinatorPassword);
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // The Secretary Apps link is visible even though this account's role is
  // Coordinator, not Secretary or manager.
  await page.getByRole('link', { name: 'Secretary Apps' }).click();
  await expect(page.getByRole('heading', { name: 'Leagues' })).toBeVisible();

  // And they can get back to their real role's area from inside the
  // Secretary layout, since they actually have one to return to.
  await page.getByRole('link', { name: 'Back to Scheduling' }).click();
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
});
