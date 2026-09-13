import { expect, test } from '@playwright/test';
import {
  assignButtonFor,
  assignButtonsFor,
  dayCellFor,
  loginAsManager,
  uniqueName,
  uniqueUsername,
} from './helpers.js';

/**
 * Milestone 24: ported from the deleted
 * `tests/e2e/employee-lifecycle-and-combined-warnings.spec.ts`. Queue-row and
 * roster-visibility assertions are scoped to this spec's own uniquely-named
 * employees (`page.locator('tr', { hasText: ... })`, `assignButtonsFor`)
 * rather than an assumed employee id or an assumed-empty grid/queue, since
 * the Schedule Board's Front Desk tab accumulates every other spec's Front
 * Desk employees in the same shared, growing database.
 */
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

test('manager-submit-on-behalf unavailability, its coexistence with approved time off on the same day, and deactivate/reactivate roster visibility', async ({
  page,
}) => {
  await loginAsManager(page);

  const jamieName = uniqueName('Jamie Employee');
  const samName = uniqueName('Sam Employee');

  // Jamie is the subject of everything below; Sam is just a second Front
  // Desk employee so the department roster is never empty once Jamie is
  // deactivated later (an empty roster short-circuits the grid to a totally
  // different empty-state view).
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(jamieName);
  await page.locator('#employee-username').fill(uniqueUsername('jamie'));
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(jamieName);

  await page.locator('#employee-name').fill(samName);
  await page.locator('#employee-username').fill(uniqueUsername('sam'));
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(samName);

  // A Front Desk template to assign later.
  const templateName = uniqueName('Front Desk AM');
  await page.getByRole('link', { name: 'Shift Templates' }).click();
  await page.locator('#template-name').fill(templateName);
  await page.locator('#template-start').fill('08:00');
  await page.locator('#template-end').fill('14:00');
  await page.getByRole('button', { name: 'Add template' }).click();
  await expect(page.getByTestId('shift-templates-table')).toContainText(templateName);

  // --- Manager-submit-on-behalf for BOTH time off and unavailability, ---
  // --- targeting the exact same day for Jamie.                        ---
  await page.getByRole('link', { name: 'Request Time Off' }).click();

  await page.locator('#timeoff-on-behalf-of').selectOption({ label: jamieName });
  await page.locator('#timeoff-start').fill(targetDate);
  await page.locator('#timeoff-end').fill(targetDate);
  await page.locator('#timeoff-reason').fill('Family emergency');
  await page.getByTestId('timeoff-submit').click();

  await page.locator('#unavailability-on-behalf-of').selectOption({ label: jamieName });
  await page.locator('#unavailability-day').selectOption({ label: targetDayLabel });
  await page.locator('#unavailability-full-day').check();
  await page.locator('#unavailability-reason').fill('Recurring commitment');
  await page.getByTestId('unavailability-submit').click();

  // Both land as already-approved, with no separate manager review step.
  await page.getByRole('link', { name: 'Time Off Queue' }).click();
  await expect(page.getByRole('heading', { name: 'Time Off Queue' })).toBeVisible();
  await page.getByRole('tab', { name: 'Approved' }).click();
  await expect(page.locator('tr', { hasText: jamieName })).toContainText('approved');

  await page.getByRole('tab', { name: 'Unavailability' }).click();
  await page.getByRole('tab', { name: 'Approved' }).click();
  const unavailabilityRow = page.locator('tr', { hasText: jamieName });
  await expect(unavailabilityRow).toContainText(targetDayLabel);
  await expect(unavailabilityRow).toContainText('approved');

  // --- Schedule Board: both mechanisms must coexist on the same cell ---
  // --- without crashing or warning about both things at once.       ---
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  // The cell shows the "Time Off" tag and clicking it warns about the
  // approved time-off block FIRST, before the assign dialog (and therefore
  // before the unavailability panel inside it) is even reachable.
  await expect(dayCellFor(page, jamieName, targetDate)).toContainText('Time Off');
  await assignButtonFor(page, jamieName, targetDate).click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await expect(page.getByTestId('confirm-dialog')).toContainText('approved time off');
  await page.getByTestId('confirm-dialog-confirm').click();
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();

  // Past that first confirm, the assign dialog opens and separately surfaces
  // the informational unavailability panel — the two mechanisms are
  // sequential and independent, not merged into one confusing prompt.
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await expect(page.getByTestId('unavailability-panel')).toBeVisible();
  await expect(page.getByTestId('unavailability-panel')).toContainText('All day');

  // Actually assigning a shift that overlaps the (full-day) unavailability
  // triggers the SECOND, distinct confirm — proving the app asks about each
  // concern in its own turn rather than double-warning up front or skipping
  // one because the other already fired.
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(templateName, { exact: true }).click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await expect(page.getByTestId('confirm-dialog')).toContainText('overlaps stated unavailability');
  await page.getByTestId('confirm-dialog-confirm').click();
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();
  await expect(
    dayCellFor(page, jamieName, targetDate).locator('[data-testid^="shift-card-"]'),
  ).toHaveCount(1);

  // --- Deactivate Jamie: they should disappear from the schedule grid ---
  // --- roster, while Sam (still active) keeps the department non-empty. ---
  await page.getByRole('link', { name: 'Employees' }).click();
  const jamieAdminRow = page.locator('tr', { hasText: jamieName });
  await jamieAdminRow.getByRole('button', { name: 'Deactivate' }).click();
  await expect(jamieAdminRow.getByText('Inactive')).toBeVisible();

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await expect(assignButtonsFor(page, jamieName)).toHaveCount(0);
  // Sam's row is still there — this is really Jamie being filtered out, not
  // the whole grid falling back to its empty-department state.
  await expect(assignButtonsFor(page, samName).first()).toBeVisible();

  // --- Reactivate Jamie via the edit form: they reappear on the grid. ---
  await page.getByRole('link', { name: 'Employees' }).click();
  await jamieAdminRow.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#employee-active').check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(jamieAdminRow.getByText('Active', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await expect(assignButtonsFor(page, jamieName).first()).toBeVisible();
});
