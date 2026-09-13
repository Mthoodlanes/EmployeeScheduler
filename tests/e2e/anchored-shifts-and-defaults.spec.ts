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
  // Fresh, isolated userData dir per test — the app auto-seeds real default
  // data (10 shift templates + weekly store hours) into this brand-new
  // database on startup; `npm run seed`'s dev-only demo data is never run
  // here, so this proves the defaults-only path works on its own.
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

/** Local YYYY-MM-DD for today, matching the app's `getTodayIso()` convention. */
function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function firstRunSetup(): Promise<void> {
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
}

test('a freshly seeded database ships default shift templates usable across departments, supports custom-time entry, and anchored shifts re-resolve live', async () => {
  await firstRunSetup();

  // An employee who works both Front Desk and Cafe, so the same shared
  // default template can be proven usable from either tab.
  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Sam Employee');
  await window.locator('#employee-username').fill('sam');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-front_desk').check();
  await window.locator('#department-cafe').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Sam Employee');

  // Confirm the 10 real default templates are already present with no
  // `npm run seed` involved — the admin page's "Shared / All Departments"
  // filter should show all 10.
  await window.getByRole('link', { name: 'Shift Templates' }).click();
  await window
    .locator('#template-filter-department')
    .selectOption({ label: 'Shared / All Departments' });
  const templatesTable = window.getByTestId('shift-templates-table');
  await expect(templatesTable).toContainText('2pm–Close');
  await expect(templatesTable).toContainText('9am–5pm');
  await expect(templatesTable.locator('tbody tr')).toHaveCount(10);

  // Open the Schedule Board — Front Desk tab is selected by default — and
  // assign the shared "2pm–Close" template to Sam's first visible day.
  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  // Pick a date that is today or later (not just the week's first/Monday
  // column, which can be in the past relative to today) so that a special
  // event added on it later in this test still counts as "upcoming".
  const cells = window.locator('[data-testid^="schedule-cell-2-"]');
  const cellTestIds = await cells.evaluateAll((elements) =>
    elements.map((el) => el.getAttribute('data-testid') ?? ''),
  );
  const cellDates = cellTestIds.map((testId) => testId.replace('schedule-cell-2-', ''));
  const today = todayIso();
  const anchoredShiftDate = cellDates.find((date) => date >= today) ?? cellDates[0];
  const customShiftDate =
    cellDates.find((date) => date > anchoredShiftDate) ?? cellDates[cellDates.length - 1];

  await window.getByTestId(`schedule-cell-2-${anchoredShiftDate}`).click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await window.getByTestId('assign-shift-dialog').getByText('2pm–Close', { exact: true }).click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();

  // The card shows the anchor treatment ("14:00–Close"), not a random
  // literal end time, plus a resolved-time note.
  const frontDeskShiftCard = window.locator('[data-testid^="shift-card-"]').first();
  await expect(frontDeskShiftCard).toContainText('14:00–Close');
  const anchorNote = window.locator('[data-testid^="shift-card-anchor-note-"]').first();
  await expect(anchorNote).toBeVisible();

  // Switch to the Cafe tab and assign the SAME shared template on the SAME
  // day — proving it is not restricted to a single department tab.
  await window.getByRole('tab', { name: 'Cafe' }).click();
  await window.getByTestId(`schedule-cell-2-${anchoredShiftDate}`).click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await window.getByTestId('assign-shift-dialog').getByText('2pm–Close', { exact: true }).click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();
  const cafeShiftCard = window.locator('[data-testid^="shift-card-"]').first();
  await expect(cafeShiftCard).toContainText('14:00–Close');

  // Back on Front Desk, use the new "custom time" mode on a different day to
  // assign a one-off shift with no saved template at all. (Note: the
  // "schedule-cell-*" testid is on the "+Assign" button itself, a SIBLING of
  // any shift cards in that day's cell, not their parent — so shift cards
  // are located globally below rather than scoped under this button.)
  await window.getByRole('tab', { name: 'Front Desk' }).click();
  await window.getByTestId(`schedule-cell-2-${customShiftDate}`).click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await window.getByTestId('assign-mode-custom').click();
  await window.locator('#assign-custom-start').fill('10:00');
  await window.locator('#assign-custom-end').fill('15:00');
  await window.getByTestId('assign-custom-submit').click();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();

  const customShiftCard = window
    .locator('button[data-testid^="shift-card-"]')
    .filter({ has: window.locator('[data-testid^="shift-card-custom-"]') });
  await expect(customShiftCard).toHaveCount(1);
  await expect(customShiftCard).toContainText('10:00–15:00');

  // Add a special event on the exact date the "2pm–Close" shift landed on,
  // extending closing time to a distinctive value.
  await window.getByRole('link', { name: 'Store Hours' }).click();
  await expect(window.getByRole('heading', { name: 'Store Hours' })).toBeVisible();
  await window.locator('#special-event-date').fill(anchoredShiftDate);
  await window.locator('#special-event-label').fill('League Night — extended close');
  await window.locator('#special-event-open').fill('14:00');
  await window.locator('#special-event-close').fill('23:45');
  await window.getByTestId('special-event-submit').click();
  await expect(window.getByTestId('special-events-table')).toContainText(
    'League Night — extended close',
  );

  // Back on the Schedule Board, the already-assigned "2pm–Close" shift's
  // resolved note now reflects the special event's later close time — proof
  // of live re-resolution rather than a frozen copy taken at assignment time.
  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  const updatedAnchorNote = window.locator('[data-testid^="shift-card-anchor-note-"]').first();
  await expect(updatedAnchorNote).toContainText('23:45');
});
