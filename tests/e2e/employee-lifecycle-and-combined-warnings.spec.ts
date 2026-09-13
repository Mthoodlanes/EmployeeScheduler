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

const DAY_OF_WEEK_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Local YYYY-MM-DD, matching the app's `getTodayIso()` convention. */
function isoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Matches the app's `getDayOfWeek()`, which parses the ISO string as UTC. */
function dayOfWeekLabelFor(iso: string): string {
  return DAY_OF_WEEK_LABELS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

// Today always falls inside the schedule grid's default visible week (which
// is the week containing today), so it's a safe target for both the
// time-off block and the unavailability window below.
const targetDate = isoDate(0);
const targetDayLabel = dayOfWeekLabelFor(targetDate);

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

async function firstRunSetup(): Promise<void> {
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
}

test('manager-submit-on-behalf unavailability, its coexistence with approved time off on the same day, and deactivate/reactivate roster visibility', async () => {
  await firstRunSetup();

  // Jamie (employee id 2) is the subject of everything below; Sam (id 3) is
  // just a second Front Desk employee so the department roster is never
  // empty once Jamie is deactivated later (an empty roster short-circuits
  // the grid to a totally different empty-state view).
  await window.getByRole('link', { name: 'Employees' }).click();
  await window.locator('#employee-name').fill('Jamie Employee');
  await window.locator('#employee-username').fill('jamie');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-front_desk').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Jamie Employee');

  await window.locator('#employee-name').fill('Sam Employee');
  await window.locator('#employee-username').fill('sam');
  await window.locator('#employee-password').fill('password123');
  await window.locator('#department-front_desk').check();
  await window.getByRole('button', { name: 'Add employee' }).click();
  await expect(window.getByTestId('employees-table')).toContainText('Sam Employee');

  // A Front Desk template to assign later.
  await window.getByRole('link', { name: 'Shift Templates' }).click();
  await window.locator('#template-name').fill('Front Desk AM');
  await window.locator('#template-start').fill('08:00');
  await window.locator('#template-end').fill('14:00');
  await window.getByRole('button', { name: 'Add template' }).click();
  await expect(window.getByTestId('shift-templates-table')).toContainText('Front Desk AM');

  // --- Manager-submit-on-behalf for BOTH time off and unavailability, ---
  // --- targeting the exact same day for Jamie.                        ---
  await window.getByRole('link', { name: 'Request Time Off' }).click();

  await window.locator('#timeoff-on-behalf-of').selectOption({ label: 'Jamie Employee' });
  await window.locator('#timeoff-start').fill(targetDate);
  await window.locator('#timeoff-end').fill(targetDate);
  await window.locator('#timeoff-reason').fill('Family emergency');
  await window.getByTestId('timeoff-submit').click();

  await window.locator('#unavailability-on-behalf-of').selectOption({ label: 'Jamie Employee' });
  await window.locator('#unavailability-day').selectOption({ label: targetDayLabel });
  await window.locator('#unavailability-full-day').check();
  await window.locator('#unavailability-reason').fill('Recurring commitment');
  await window.getByTestId('unavailability-submit').click();

  // Both land as already-approved, with no separate manager review step —
  // mirrors the existing on-behalf time-off coverage, extended here to also
  // cover the previously-untested on-behalf unavailability path.
  await window.getByRole('link', { name: 'Time Off Queue' }).click();
  await expect(window.getByRole('heading', { name: 'Time Off Queue' })).toBeVisible();
  await window.getByRole('tab', { name: 'Approved' }).click();
  await expect(window.getByTestId('timeoff-queue-table')).toContainText('Jamie Employee');
  await expect(window.getByTestId('timeoff-queue-table')).toContainText('approved');

  await window.getByRole('tab', { name: 'Unavailability' }).click();
  await window.getByRole('tab', { name: 'Approved' }).click();
  const unavailabilityQueueTable = window.getByTestId('unavailability-queue-table');
  await expect(unavailabilityQueueTable).toContainText('Jamie Employee');
  await expect(unavailabilityQueueTable).toContainText(targetDayLabel);
  await expect(unavailabilityQueueTable).toContainText('approved');

  // --- Schedule Board: both mechanisms must coexist on the same cell ---
  // --- without crashing or warning about both things at once.       ---
  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  // The cell renders the "Time Off" tag and clicking it warns about the
  // approved time-off block FIRST, before the assign dialog (and therefore
  // before the unavailability panel inside it) is even reachable.
  await expect(window.getByTestId(`timeoff-blocked-2-${targetDate}`)).toBeVisible();
  await window.getByTestId(`schedule-cell-2-${targetDate}`).click();
  await expect(window.getByTestId('confirm-dialog')).toBeVisible();
  await expect(window.getByTestId('confirm-dialog')).toContainText('approved time off');
  await window.getByTestId('confirm-dialog-confirm').click();
  await expect(window.getByTestId('confirm-dialog')).toBeHidden();

  // Past that first confirm, the assign dialog opens and separately surfaces
  // the informational unavailability panel — the two mechanisms are
  // sequential and independent, not merged into one confusing prompt.
  await expect(window.getByTestId('assign-shift-dialog')).toBeVisible();
  await expect(window.getByTestId('unavailability-panel')).toBeVisible();
  await expect(window.getByTestId('unavailability-panel')).toContainText('All day');

  // Actually assigning a shift that overlaps the (full-day) unavailability
  // triggers the SECOND, distinct confirm — proving the app asks about each
  // concern in its own turn rather than double-warning up front or skipping
  // one because the other already fired.
  await window.locator('[data-testid^="assign-template-"]').first().click();
  await expect(window.getByTestId('confirm-dialog')).toBeVisible();
  await expect(window.getByTestId('confirm-dialog')).toContainText('overlaps stated unavailability');
  await window.getByTestId('confirm-dialog-confirm').click();
  await expect(window.getByTestId('confirm-dialog')).toBeHidden();
  await expect(window.getByTestId('assign-shift-dialog')).toBeHidden();
  await expect(window.locator('[data-testid^="shift-card-"]')).toHaveCount(1);

  // --- Deactivate Jamie: they should disappear from the schedule grid ---
  // --- roster, while Sam (still active) keeps the department non-empty. ---
  await window.getByRole('link', { name: 'Employees' }).click();
  const jamieRow = window.locator('tr', { hasText: 'Jamie Employee' });
  await jamieRow.getByRole('button', { name: 'Deactivate' }).click();
  await expect(jamieRow.getByText('Inactive')).toBeVisible();

  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await expect(window.locator('[data-testid^="schedule-cell-2-"]')).toHaveCount(0);
  // Sam's row is still there — this is really Jamie being filtered out, not
  // the whole grid falling back to its empty-department state.
  await expect(window.locator('[data-testid^="schedule-cell-3-"]').first()).toBeVisible();

  // --- Reactivate Jamie via the edit form: they reappear on the grid. ---
  await window.getByRole('link', { name: 'Employees' }).click();
  await jamieRow.getByRole('button', { name: 'Edit' }).click();
  await window.locator('#employee-active').check();
  await window.getByRole('button', { name: 'Save changes' }).click();
  await expect(jamieRow.getByText('Active', { exact: true })).toBeVisible();

  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await expect(window.locator('[data-testid^="schedule-cell-2-"]').first()).toBeVisible();
});
