import { expect, test } from '@playwright/test';
import {
  assignButtonFor,
  dayCellFor,
  datesFromAssignButtons,
  loginAsManager,
  uniqueName,
  uniqueUsername,
} from './helpers.js';

/**
 * Milestone 24: ported from the deleted
 * `tests/e2e/anchored-shifts-and-defaults.spec.ts`.
 *
 * ADAPTATION (a genuine gap, not just a test-porting detail): the original
 * spec's premise was that a freshly-seeded database already has 10 default
 * shift templates AND weekly store hours, because Phase 1's Electron main
 * process (`src/main/db/seedDefaults.ts`, deleted in Milestone 23) auto-ran
 * that seed on every fresh SQLite install. Milestone 23 converted the app
 * into a thin shell around the hosted Postgres-backed server, and `server/`
 * has NO equivalent auto-seeding anywhere — a fresh Postgres database (like
 * this suite's truncated TEST branch) starts with ZERO shift templates AND
 * ZERO store-hours rows. That second part matters even beyond templates: per
 * `hoursResolution.ts`'s `resolveHoursForDate`, a day-of-week with no
 * `store_hours` row resolves as fully closed, which means an "anchored"
 * template (start/end tied to store open/close) can never resolve to an
 * actual time until *some* weekly default hours exist — not just a template
 * naming/reuse gap, but a real behavioral dependency this spec must satisfy
 * itself rather than assume. This spec now creates its own weekly default
 * hours (via the UI, matching what a real manager would do on day one) and
 * its own shared/anchored shift template, then exercises the same
 * cross-department reuse / custom-time / live-re-resolution behavior the
 * original spec covered.
 */
function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test('a shared anchored shift template is usable across departments, supports custom-time entry, and re-resolves live against a special event', async ({
  page,
}) => {
  await loginAsManager(page);

  // Establish weekly default store hours for every day of the week — see
  // the file-header note: nothing seeds this on a fresh database, and an
  // anchored template cannot resolve without it. The form already prefills
  // sensible defaults (10:00-22:00) for any day with no existing row, so
  // saving each row as-is is enough.
  await page.getByRole('link', { name: 'Store Hours' }).click();
  await expect(page.getByRole('heading', { name: 'Store Hours' })).toBeVisible();
  // Each day's save must complete (and be confirmed) before moving to the
  // next, since they run against the same live form fields.
  for (let day = 0; day < 7; day += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.getByTestId(`store-hours-save-${day}`).click();
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByTestId(`store-hours-saved-${day}`)).toBeVisible();
  }

  // An employee who works both Front Desk and Cafe, so the same shared
  // template can be proven usable from either tab.
  const employeeName = uniqueName('Sam Employee');
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(uniqueUsername('sam'));
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.locator('#department-cafe').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  // A shared ("All Departments") template anchored to the store's close time.
  const templateName = uniqueName('2pm–Close');
  await page.getByRole('link', { name: 'Shift Templates' }).click();
  await page.locator('#template-name').fill(templateName);
  await page.locator('#template-department').selectOption({ label: 'All Departments (Shared)' });
  await page.locator('#template-start').fill('14:00');
  await page.locator('#template-end-anchor').selectOption({ label: 'Closes with store' });
  await page.getByRole('button', { name: 'Add template' }).click();
  await page
    .locator('#template-filter-department')
    .selectOption({ label: 'Shared / All Departments' });
  await expect(page.getByTestId('shift-templates-table')).toContainText(templateName);

  // Open the Schedule Board — Front Desk tab is selected by default.
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  // Pick a date that is today or later (not just the week's first/Monday
  // column, which can be in the past relative to today) so that a special
  // event added on it later in this test still counts as "upcoming".
  const cellDates = await datesFromAssignButtons(page, employeeName);
  const today = todayIso();
  const anchoredShiftDate = cellDates.find((date) => date >= today) ?? cellDates[0];
  // Just needs to be a DIFFERENT day than `anchoredShiftDate` within the same
  // visible week — unlike `anchoredShiftDate`, nothing later in this test
  // requires it to be today-or-later, so an earlier-in-the-week date is a
  // fine fallback. Previously fell back to `cellDates[cellDates.length - 1]`
  // unconditionally, which collided with `anchoredShiftDate` whenever today
  // landed on the week's last visible day (e.g. a Sunday-ending week).
  const customShiftDate =
    cellDates.find((date) => date > anchoredShiftDate) ??
    [...cellDates].reverse().find((date) => date < anchoredShiftDate) ??
    cellDates[0];

  await assignButtonFor(page, employeeName, anchoredShiftDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(templateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  // The card shows the anchor treatment ("14:00–Close"), not a random
  // literal end time, plus a resolved-time note.
  const frontDeskCell = dayCellFor(page, employeeName, anchoredShiftDate);
  await expect(frontDeskCell).toContainText('14:00–Close');
  await expect(frontDeskCell.locator('[data-testid^="shift-card-anchor-note-"]')).toBeVisible();
  // Assigned from a standard (saved) template, so the card shows the
  // template's name rather than staying unlabeled.
  await expect(frontDeskCell.locator('[data-testid^="shift-card-template-"]')).toContainText(
    templateName,
  );

  // Switch to the Cafe tab and assign the SAME shared template on the SAME
  // day — proving it is not restricted to a single department tab.
  await page.getByRole('tab', { name: 'Cafe' }).click();
  await assignButtonFor(page, employeeName, anchoredShiftDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-template').click();
  await page.getByTestId('assign-shift-dialog').getByText(templateName, { exact: true }).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();
  const cafeCell = dayCellFor(page, employeeName, anchoredShiftDate);
  await expect(cafeCell).toContainText('14:00–Close');

  // Back on Front Desk, use the "custom time" mode on a different day to
  // assign a one-off shift with no saved template at all.
  await page.getByRole('tab', { name: 'Front Desk' }).click();
  await assignButtonFor(page, employeeName, customShiftDate).click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeVisible();
  await page.getByTestId('assign-mode-custom').click();
  await page.locator('#assign-custom-start').fill('10:00');
  await page.locator('#assign-custom-end').fill('15:00');
  await page.getByTestId('assign-custom-submit').click();
  await expect(page.getByTestId('assign-shift-dialog')).toBeHidden();

  const customCell = dayCellFor(page, employeeName, customShiftDate);
  const customShiftCard = customCell.locator('button[data-testid^="shift-card-"]');
  await expect(customShiftCard).toHaveCount(1);
  await expect(customShiftCard).toContainText('10:00–15:00');
  // A one-off custom-time shift has no saved template, so it must not show
  // a template-name badge (that badge is reserved for standard templates).
  await expect(customCell.locator('[data-testid^="shift-card-template-"]')).toHaveCount(0);

  // Add a special event on the exact date the "2pm–Close" shift landed on,
  // extending closing time to a distinctive value.
  await page.getByRole('link', { name: 'Store Hours' }).click();
  await expect(page.getByRole('heading', { name: 'Store Hours' })).toBeVisible();
  const eventLabel = uniqueName('League Night — extended close');
  await page.locator('#special-event-date').fill(anchoredShiftDate);
  await page.locator('#special-event-label').fill(eventLabel);
  await page.locator('#special-event-open').fill('14:00');
  await page.locator('#special-event-close').fill('23:45');
  await page.getByTestId('special-event-submit').click();
  await expect(page.getByTestId('special-events-table')).toContainText(eventLabel);

  // Back on the Schedule Board, the already-assigned "2pm–Close" shift's
  // resolved note now reflects the special event's later close time — proof
  // of live re-resolution rather than a frozen copy taken at assignment time.
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await expect(
    dayCellFor(page, employeeName, anchoredShiftDate).locator('[data-testid^="shift-card-anchor-note-"]'),
  ).toContainText('23:45');
});
