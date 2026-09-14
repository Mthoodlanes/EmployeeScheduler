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

  // Drag Carol's row up to Alice's position. Wait for the reorder PUT's
  // actual response (not a fixed timeout) before doing anything else —
  // found live: a `page.reload()` fired while this request was still
  // in-flight aborts it outright (a navigation cancels pending requests on
  // the page), so the drop would look right optimistically but never
  // actually persist, and a fixed short timeout doesn't reliably outlast a
  // real network round-trip to the Neon test branch.
  const reorderPersisted = page.waitForResponse(
    (res) => res.url().includes('/api/employees/reorder') && res.request().method() === 'PUT',
  );
  await dragHandleFor(page, carolName).scrollIntoViewIfNeeded();
  await dragHandleFor(page, aliceName).scrollIntoViewIfNeeded();
  await dragEmployeeRow(page, carolName, aliceName);

  // The new order takes effect immediately (optimistic update) …
  await expect(relativeOrder(await employeeRowOrder(page), employeeNames)).toEqual([
    carolName,
    aliceName,
    bobName,
  ]);

  // … and persists after the mutation round-trips to the database. Reload
  // the page outright (a harder guarantee than just re-rendering from
  // cache) to confirm it was actually written through.
  await reorderPersisted;
  await page.reload();
  // The hash route (#/schedule) persists across reload, so the app resumes
  // directly on the Schedule Board rather than redirecting through
  // "My Schedule" first.
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  // A one-shot `.allTextContents()` snapshot right after reload can fire
  // before the freshly-mounted app has finished its own employees fetch —
  // caught live returning an empty array. `expect.poll()` retries the whole
  // read (not just a single locator's assertion) until the roster has
  // actually loaded.
  await expect
    .poll(async () => relativeOrder(await employeeRowOrder(page), employeeNames))
    .toEqual([carolName, aliceName, bobName]);

  // And survives a full logout/login cycle too, not just a reload.
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByTestId('login-username')).toBeVisible();
  await loginAsManager(page);

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect
    .poll(async () => relativeOrder(await employeeRowOrder(page), employeeNames))
    .toEqual([carolName, aliceName, bobName]);

  // The Employees admin page, meanwhile, must still be alphabetical —
  // unaffected by the Schedule Board's manual order.
  await page.getByRole('link', { name: 'Employees' }).click();
  const adminOrder = await page
    .getByTestId('employees-table')
    .locator('tbody tr td:first-child')
    .allTextContents();
  expect(relativeOrder(adminOrder, employeeNames)).toEqual([aliceName, bobName, carolName]);
});
