import { expect, test } from '@playwright/test';
import {
  dragEmployeeRow,
  dragHandleFor,
  employeeRowOrder,
  loginAsManager,
  relativeOrder,
  uniqueName,
  uniqueUsername,
} from './helpers.js';

/**
 * Milestone 24: ported from the deleted `tests/e2e/employee-reorder.spec.ts`.
 * The Schedule Board's Front Desk tab accumulates every other spec's Front
 * Desk employees in this shared, growing database, so this spec can no
 * longer assert exact row counts/positions or exact employee ids (the
 * original comment "Alice=2, Bob=3, Carol=4 in a fresh database" no longer
 * holds) — it uses uniquely-named employees and `relativeOrder()` to check
 * only THEIR relative ordering, ignoring every other row on the board.
 */
test('manager drag-reorders employees on the Schedule Board and the order survives a relogin', async ({
  page,
}) => {
  await loginAsManager(page);

  // Create three Front Desk employees — they'll be appended to the end of
  // the Schedule Board's existing order, i.e. Alice, then Bob, then Carol,
  // relative to each other.
  await page.getByRole('link', { name: 'Employees' }).click();
  const aliceName = uniqueName('Alice One');
  const bobName = uniqueName('Bob Two');
  const carolName = uniqueName('Carol Three');
  const employeeNames = [aliceName, bobName, carolName];
  /* eslint-disable no-await-in-loop -- each employee's form submission must fully
     complete (and be confirmed in the table) before the next one starts, since
     they share the same form fields. */
  for (const [index, name] of employeeNames.entries()) {
    await page.locator('#employee-name').fill(name);
    await page.locator('#employee-username').fill(uniqueUsername(`emp${index}`));
    await page.locator('#employee-password').fill('password123');
    await page.locator('#department-front_desk').check();
    await page.getByRole('button', { name: 'Add employee' }).click();
    await expect(page.getByTestId('employees-table')).toContainText(name);
  }
  /* eslint-enable no-await-in-loop */

  // Open the Schedule Board — Front Desk is the default tab.
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await expect(relativeOrder(await employeeRowOrder(page), employeeNames)).toEqual([
    aliceName,
    bobName,
    carolName,
  ]);

  // Drag Carol's row up to Alice's position.
  await dragHandleFor(page, carolName).scrollIntoViewIfNeeded();
  await dragHandleFor(page, aliceName).scrollIntoViewIfNeeded();
  await dragEmployeeRow(page, carolName, aliceName);

  // The new order takes effect immediately (optimistic update) …
  await expect(relativeOrder(await employeeRowOrder(page), employeeNames)).toEqual([
    carolName,
    aliceName,
    bobName,
  ]);

  // … and persists after the mutation round-trips to the database. Give the
  // request a moment, then reload the page outright (a harder guarantee than
  // just re-rendering from cache) to confirm it was actually written through.
  await page.waitForTimeout(500);
  await page.reload();
  // The hash route (#/schedule) persists across reload, so the app resumes
  // directly on the Schedule Board rather than redirecting through
  // "My Schedule" first.
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await expect(relativeOrder(await employeeRowOrder(page), employeeNames)).toEqual([
    carolName,
    aliceName,
    bobName,
  ]);

  // And survives a full logout/login cycle too, not just a reload.
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByTestId('login-username')).toBeVisible();
  await loginAsManager(page);

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(relativeOrder(await employeeRowOrder(page), employeeNames)).toEqual([
    carolName,
    aliceName,
    bobName,
  ]);

  // The Employees admin page, meanwhile, must still be alphabetical —
  // unaffected by the Schedule Board's manual order.
  await page.getByRole('link', { name: 'Employees' }).click();
  const adminOrder = await page
    .getByTestId('employees-table')
    .locator('tbody tr td:first-child')
    .allTextContents();
  expect(relativeOrder(adminOrder, employeeNames)).toEqual([aliceName, bobName, carolName]);
});
