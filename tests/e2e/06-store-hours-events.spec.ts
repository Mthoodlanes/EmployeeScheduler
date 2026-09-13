import { expect, test } from '@playwright/test';
import { loginAsManager, uniqueName, uniqueUsername } from './helpers.js';

/**
 * Milestone 24: ported from the deleted `tests/e2e/store-hours-events.spec.ts`.
 * `store_hours`/`special_event_overrides` are global (not per-employee)
 * tables, so this spec's own weekly-hours edit (Wednesday) and special event
 * are the only state it needs to assert on — no employee-scoping concerns
 * the way shift/time-off specs have, beyond giving its one employee and
 * event label unique names so `toContainText` checks can't accidentally
 * match another spec's row.
 */
/** The Wednesday of NEXT week, Monday-start, matching the app's `weekRange.ts` convention. */
function nextWeekWednesdayIso(): string {
  const now = new Date();
  const utcToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const diffToMonday = (utcToday.getUTCDay() + 6) % 7;
  const thisMonday = new Date(utcToday.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
  const nextWednesday = new Date(thisMonday.getTime() + 9 * 24 * 60 * 60 * 1000);
  return nextWednesday.toISOString().slice(0, 10);
}

test('manager sets weekly default hours, adds a special event override, and it appears on the schedule board', async ({
  page,
}) => {
  await loginAsManager(page);

  await page.getByRole('link', { name: 'Store Hours' }).click();
  await expect(page.getByRole('heading', { name: 'Store Hours' })).toBeVisible();
  await expect(page.getByTestId('store-hours-table')).toBeVisible();

  // Set Wednesday's (index 3) weekly default hours and save just that row.
  await page.getByTestId('store-hours-open-3').fill('09:00');
  await page.getByTestId('store-hours-close-3').fill('21:00');
  await page.getByTestId('store-hours-save-3').click();
  await expect(page.getByTestId('store-hours-saved-3')).toBeVisible();

  // Reload the page (clears any in-memory query cache but not the server-side
  // session/DB) to confirm the change actually persisted rather than only
  // living in client-side cache.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Store Hours' })).toBeVisible();
  await expect(page.getByTestId('store-hours-open-3')).toHaveValue('09:00');
  await expect(page.getByTestId('store-hours-close-3')).toHaveValue('21:00');

  // Edit it again to confirm the editor round-trips an existing value too.
  await page.getByTestId('store-hours-close-3').fill('22:00');
  await page.getByTestId('store-hours-save-3').click();
  await expect(page.getByTestId('store-hours-saved-3')).toBeVisible();

  // Add a special event override for a specific near-future date with custom
  // hours and a required label.
  const eventDate = nextWeekWednesdayIso();
  const eventLabel = uniqueName('League Night — opens early');
  await page.locator('#special-event-date').fill(eventDate);
  await page.locator('#special-event-label').fill(eventLabel);
  await page.locator('#special-event-open').fill('08:00');
  await page.locator('#special-event-close').fill('22:00');
  await page.getByTestId('special-event-submit').click();
  await expect(page.getByTestId('special-events-table')).toContainText(eventLabel);
  await expect(page.getByTestId('special-events-table')).toContainText(eventDate);

  // The schedule grid only renders its day-column headers once at least one
  // employee is assigned to the active department's tab (Front Desk, by
  // default) — otherwise it short-circuits to an empty-state message.
  const employeeName = uniqueName('Sam Employee');
  await page.getByRole('link', { name: 'Employees' }).click();
  await page.locator('#employee-name').fill(employeeName);
  await page.locator('#employee-username').fill(uniqueUsername('sam'));
  await page.locator('#employee-password').fill('password123');
  await page.locator('#department-front_desk').check();
  await page.getByRole('button', { name: 'Add employee' }).click();
  await expect(page.getByTestId('employees-table')).toContainText(employeeName);

  // Open the Schedule Board and navigate to next week, where the override date falls.
  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();
  await page.getByRole('button', { name: 'Next week →' }).click();

  // That date's column header shows the special-event badge with its label
  // instead of the plain default hours.
  const eventBadge = page.getByTestId('hours-badge-event').filter({ hasText: eventLabel });
  await expect(eventBadge).toBeVisible();
  await expect(eventBadge).toContainText('08:00–22:00');
});
