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

/**
 * Drags the row identified by `dragHandleTestId` to the vertical position of
 * the row identified by `targetHandleTestId`, via a raw pointer down/move/up
 * sequence (not Playwright's `dragTo()`, which simulates the native HTML5
 * Drag and Drop API — @dnd-kit is Pointer-Events-based instead, precisely so
 * it also works on touch devices). Several intermediate `mouse.move()` steps
 * are required so @dnd-kit's `PointerSensor` activation distance is crossed
 * and its collision detection has a chance to register the swap before drop.
 */
async function dragRowTo(
  page: Page,
  dragHandleTestId: string,
  targetHandleTestId: string,
): Promise<void> {
  const source = page.getByTestId(dragHandleTestId);
  const target = page.getByTestId(targetHandleTestId);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error('Could not measure drag handle bounding boxes');
  }

  const sourceCenter = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  const targetCenter = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };

  await page.mouse.move(sourceCenter.x, sourceCenter.y);
  await page.mouse.down();
  // Step through a midpoint first so intermediate pointermove events cross
  // the activation distance and let @dnd-kit's collision detection track the
  // hovered row before the final drop position.
  await page.mouse.move(
    sourceCenter.x + (targetCenter.x - sourceCenter.x) / 2,
    sourceCenter.y + (targetCenter.y - sourceCenter.y) / 2,
    { steps: 8 },
  );
  await page.mouse.move(targetCenter.x, targetCenter.y, { steps: 8 });
  await page.mouse.up();
}

async function employeeRowOrder(page: Page): Promise<string[]> {
  return page.locator('.schedule-grid-employee-name').allTextContents();
}

test('manager drag-reorders employees on the Schedule Board and the order survives a relogin', async () => {
  // First-run setup creates the manager account and logs them straight in.
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  // Create three Front Desk employees — they'll appear on the Schedule
  // Board's default (front_desk) tab in creation order (append-at-the-end
  // sort_order), i.e. Alice, Bob, then Carol.
  await window.getByRole('link', { name: 'Employees' }).click();
  const employeeNames = ['Alice One', 'Bob Two', 'Carol Three'];
  /* eslint-disable no-await-in-loop -- each employee's form submission must fully
     complete (and be confirmed in the table) before the next one starts, since
     they share the same form fields. */
  for (const [index, name] of employeeNames.entries()) {
    await window.locator('#employee-name').fill(name);
    await window.locator('#employee-username').fill(`emp${index}`);
    await window.locator('#employee-password').fill('password123');
    await window.locator('#department-front_desk').check();
    await window.getByRole('button', { name: 'Add employee' }).click();
    await expect(window.getByTestId('employees-table')).toContainText(name);
  }
  /* eslint-enable no-await-in-loop */

  // Open the Schedule Board — Front Desk is the default tab.
  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await expect(window.locator('.schedule-grid-employee-name')).toHaveCount(3);
  await expect(employeeRowOrder(window)).resolves.toEqual(['Alice One', 'Bob Two', 'Carol Three']);

  // Manager account has ids: manager=1, Alice=2, Bob=3, Carol=4 (deterministic
  // creation order in a fresh database — see other e2e specs relying on the
  // same numbering).
  await dragRowTo(window, 'employee-drag-handle-4', 'employee-drag-handle-2');

  // The new order takes effect immediately (optimistic update) …
  await expect(employeeRowOrder(window)).resolves.toEqual(['Carol Three', 'Alice One', 'Bob Two']);

  // … and persists after the mutation round-trips to the database. Give the
  // request a moment, then reload the page outright (a harder guarantee than
  // just re-rendering from cache) to confirm it was actually written through.
  await window.waitForTimeout(500);
  await window.reload();
  await window.waitForLoadState('domcontentloaded');
  // The hash route (#/schedule) persists across reload, so the app resumes
  // directly on the Schedule Board rather than redirecting through
  // "My Schedule" first.
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await expect(window.locator('.schedule-grid-employee-name')).toHaveCount(3);
  await expect(employeeRowOrder(window)).resolves.toEqual(['Carol Three', 'Alice One', 'Bob Two']);

  // And survives a full logout/login cycle too, not just a reload.
  await window.getByRole('button', { name: 'Log out' }).click();
  await expect(window.getByTestId('login-username')).toBeVisible();
  await window.getByTestId('login-username').fill('dana');
  await window.getByTestId('login-password').fill('supersecret1');
  await window.getByTestId('login-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.locator('.schedule-grid-employee-name')).toHaveCount(3);
  await expect(employeeRowOrder(window)).resolves.toEqual(['Carol Three', 'Alice One', 'Bob Two']);

  // The Employees admin page, meanwhile, must still be alphabetical —
  // unaffected by the Schedule Board's manual order.
  await window.getByRole('link', { name: 'Employees' }).click();
  const adminOrder = await window
    .getByTestId('employees-table')
    .locator('tbody tr td:first-child')
    .allTextContents();
  expect(adminOrder).toEqual(['Alice One', 'Bob Two', 'Carol Three', 'Dana Manager']);
});
