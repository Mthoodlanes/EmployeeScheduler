/**
 * Milestone 24: shared helpers for the ported (plain `page.goto`) E2E specs.
 *
 * Design note — why these are keyed by NAME, not employee id: the Neon test
 * branch is truncated once at the start of the whole run (`global-setup.ts`)
 * and then shared, growing, across every spec file for the rest of the run
 * (Playwright's `webServer`/DB isolation model has no per-test reset the way
 * Phase 1's per-test `--user-data-dir` SQLite database did). That means
 * employee ids are NOT predictable/stable the way the old `_electron` specs
 * assumed (e.g. "Casey is employee id 2 — the first employee created after
 * the manager") — a later spec's ids depend on how many employees every
 * earlier spec already created. Every helper below locates elements via
 * stable, id-independent signals instead (an aria-label built from the
 * employee's name + date, or the employee's name itself) — see
 * `Grid.tsx`/`AssignShiftDialog.tsx` for where those labels come from.
 *
 * The other half of that same design decision — since the DB is shared, not
 * reset per spec — is `uniqueId()`/`uniqueName()` below: every spec creates
 * its own employees with a run-unique suffix baked into both the username
 * (DB-enforced unique anyway) AND the display name, so a `<select>` option
 * label lookup (`selectOption({ label })`) or a `tr`/text-based locator can
 * never accidentally match another spec file's same-named "Alex Employee" /
 * "Sam Employee" row from earlier in the same run.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { MANAGER_PASSWORD, MANAGER_USERNAME } from './testAccounts.js';

let uniqueCounter = 0;

/** A short string, unique within this run, safe to embed in a username or display name. */
export function uniqueId(): string {
  uniqueCounter += 1;
  return `${Date.now()}${uniqueCounter}`;
}

/** e.g. uniqueName('Alex Employee') -> 'Alex Employee 17573201991' — still reads fine in the UI, and `toContainText('Alex Employee')` still matches it (substring). */
export function uniqueName(base: string): string {
  return `${base} ${uniqueId()}`;
}

export function uniqueUsername(base: string): string {
  return `${base}-${uniqueId()}`;
}

export async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/');
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}

/** Logs in as the one shared manager account (see `testAccounts.ts`). */
export async function loginAsManager(page: Page): Promise<void> {
  await login(page, MANAGER_USERNAME, MANAGER_PASSWORD);
  await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Log out' }).click();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The Schedule Board's "+Assign"/"+Add another" button for one employee/date
 * cell (see `Grid.tsx`'s `aria-label={\`Assign shift for ${employee.name} on ${day.date}\`}`)
 * — id-independent by design (see file header).
 */
export function assignButtonFor(page: Page, employeeName: string, date: string): Locator {
  return page.getByRole('button', { name: `Assign shift for ${employeeName} on ${date}`, exact: true });
}

/** Every one of one employee's assign buttons across the currently visible week — for scenarios that need to discover a date (e.g. "the next Monday") rather than target one they already know. */
export function assignButtonsFor(page: Page, employeeName: string): Locator {
  return page.getByRole('button', {
    name: new RegExp(`^Assign shift for ${escapeRegExp(employeeName)} on `),
  });
}

/** The `YYYY-MM-DD` dates of every currently-visible day cell for one employee, in day-column order. */
export async function datesFromAssignButtons(page: Page, employeeName: string): Promise<string[]> {
  const prefix = `Assign shift for ${employeeName} on `;
  const labels = await assignButtonsFor(page, employeeName).evaluateAll((elements) =>
    elements.map((el) => el.getAttribute('aria-label') ?? ''),
  );
  return labels.filter((label) => label.startsWith(prefix)).map((label) => label.slice(prefix.length));
}

/** The grid cell (one day column) containing one employee's row for `date` — the assign button's parent — used to scope shift-card/blocked-tag lookups so counts never pick up another spec's shifts elsewhere on the board. */
export function dayCellFor(page: Page, employeeName: string, date: string): Locator {
  return assignButtonFor(page, employeeName, date).locator('xpath=..');
}

/** The drag-handle button for one employee's Schedule Board row (see `Grid.tsx`'s `aria-label={\`Reorder ${employee.name}\`}`). */
export function dragHandleFor(page: Page, employeeName: string): Locator {
  return page.getByRole('button', { name: `Reorder ${employeeName}`, exact: true });
}

/**
 * Drags one employee row's handle to another's, via a raw pointer
 * down/move/up sequence (not Playwright's `dragTo()`, which simulates the
 * native HTML5 Drag and Drop API — @dnd-kit is Pointer-Events-based instead).
 * Several intermediate `mouse.move()` steps are required so @dnd-kit's
 * `PointerSensor` activation distance is crossed and its collision detection
 * has a chance to register the swap before drop.
 */
export async function dragEmployeeRow(
  page: Page,
  fromEmployeeName: string,
  toEmployeeName: string,
): Promise<void> {
  const source = dragHandleFor(page, fromEmployeeName);
  const target = dragHandleFor(page, toEmployeeName);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error('Could not measure drag handle bounding boxes');
  }

  const sourceCenter = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  const targetCenter = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };

  await page.mouse.move(sourceCenter.x, sourceCenter.y);
  await page.mouse.down();
  await page.mouse.move(
    sourceCenter.x + (targetCenter.x - sourceCenter.x) / 2,
    sourceCenter.y + (targetCenter.y - sourceCenter.y) / 2,
    { steps: 8 },
  );
  await page.mouse.move(targetCenter.x, targetCenter.y, { steps: 8 });
  await page.mouse.up();
}

/** Every visible Schedule Board row's employee name, in on-screen (top-to-bottom) order. */
export async function employeeRowOrder(page: Page): Promise<string[]> {
  return page.locator('.schedule-grid-employee-name').allTextContents();
}

/** `fullOrder`, keeping only the names that are one of `names` — preserves relative order, so a reorder assertion works even though the shared test DB accumulates other specs' employees on the same department tab. */
export function relativeOrder(fullOrder: string[], names: string[]): string[] {
  const wanted = new Set(names);
  return fullOrder.filter((name) => wanted.has(name));
}
