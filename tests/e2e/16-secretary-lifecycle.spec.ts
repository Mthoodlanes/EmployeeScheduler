import { expect, test } from '@playwright/test';
import { loginAsManager, uniqueName } from './helpers.js';

/**
 * Milestone 10 of the Secretary Apps (Bowling Dues Tracker) rebuild — the
 * full league lifecycle end to end: create a league → configure Setup →
 * add a team/bowler on Roster → record real weekly entries → confirm Weekly
 * Banking's cash breakdown and the Bowler/Season Summary balances all match
 * hand-calculated expectations for the same input data (per the plan's
 * verification section). `15-secretary-login.spec.ts` already covers the
 * dedicated login door/role-guard end to end, so this spec starts already
 * logged in as the manager and focuses purely on the dues-tracker flow.
 *
 * Hand-calculated expectations for this scenario (spotsPerTeam=2, lineage=5,
 * prizeFund=10 -> $15/week standard due, vacancyFee=3, 1 bowler on a
 * 2-spot team, both of the league's 2 weeks paid in full at $15):
 * - Each week: 1 vacant spot -> $3 vacancy fee; requirement = $15 + $3 = $18;
 *   fully covered -> Total Cash $15, Lineage Pass-Through $5, League Keeps $10.
 * - Season Summary team row: Dues Due = $30 (bowler) + $6 (2 weeks vacancy) =
 *   $36; Dues Paid = $30; Dues Balance = $6 (the uncollected vacancy fees).
 * - Bowler Summary row: Total Due $30, Total Paid $30, Balance $0.
 */
test('a full league lifecycle: setup, roster, weekly entries, banking, and summaries all agree', async ({
  page,
}) => {
  await loginAsManager(page);
  await page.getByRole('link', { name: 'Secretary Apps' }).click();
  await expect(page.getByRole('heading', { name: 'Leagues' })).toBeVisible();

  const leagueName = uniqueName('Lifecycle League');
  await page.locator('#new-league-name').fill(leagueName);
  await page.getByRole('button', { name: 'Add league' }).click();
  await page.getByRole('link', { name: leagueName }).click();

  // --- Setup ---
  await page.locator('#league-spots-per-team').fill('2');
  await page.locator('#league-num-weeks').fill('2');
  await page.locator('#league-current-week').fill('2');
  await page.locator('#league-prize-fund').fill('10');
  await page.locator('#league-lineage').fill('5');
  await page.locator('#league-vacancy-fee').fill('3');
  await page.locator('#league-sanctioned').uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  // --- Roster ---
  await page.getByRole('link', { name: 'Roster' }).click();
  await page.getByRole('button', { name: '+ Add Team' }).click();

  const bowlerName = uniqueName('Lifecycle Bowler');
  await page.locator('#bowler-name').fill(bowlerName);
  await page.getByRole('button', { name: 'Add bowler' }).click();
  await expect(page.getByTestId('secretary-roster-bowlers-table')).toContainText(bowlerName);

  // --- Weekly Entries: pay the full $15 due in both weeks ---
  await page.getByRole('link', { name: 'Weekly Entries' }).click();
  await page.locator('#weekly-entries-week-select').selectOption('1');
  const week1Playing = page.getByLabel(`${bowlerName} playing in week 1`);
  if (!(await week1Playing.isChecked())) {
    await week1Playing.click();
  }
  await expect(week1Playing).toBeChecked();
  await page.getByLabel(`${bowlerName} amount paid week 1`).fill('15');
  await page.getByLabel(`${bowlerName} amount paid week 1`).blur();
  await expect(page.getByLabel(`${bowlerName} amount paid week 1`)).toHaveValue('15');

  await page.locator('#weekly-entries-week-select').selectOption('2');
  const week2Playing = page.getByLabel(`${bowlerName} playing in week 2`);
  if (!(await week2Playing.isChecked())) {
    await week2Playing.click();
  }
  await expect(week2Playing).toBeChecked();
  await page.getByLabel(`${bowlerName} amount paid week 2`).fill('15');
  await page.getByLabel(`${bowlerName} amount paid week 2`).blur();
  await expect(page.getByLabel(`${bowlerName} amount paid week 2`)).toHaveValue('15');

  // --- Weekly Banking: confirm this week's (week 2) cash breakdown ---
  await page.getByRole('link', { name: 'Weekly Banking' }).click();
  const bankingTable = page.locator('table.data-table').first();
  await expect(bankingTable).toContainText('$15.00'); // Covered This Week
  await expect(bankingTable).toContainText('$5.00'); // Lineage Pass-Through
  await expect(bankingTable).toContainText('$10.00'); // League Keeps

  const historyTable = page.getByTestId('weekly-banking-history-table');
  await expect(historyTable).toContainText('$18.00'); // requirement, either week

  // --- Bowler Summary ---
  await page.getByRole('link', { name: 'Bowler Summary' }).click();
  const bowlerRow = page.getByRole('row', { name: new RegExp(bowlerName) });
  await expect(bowlerRow).toContainText('$30.00'); // Total Due
  await expect(bowlerRow).toContainText('$0.00'); // Balance
  await expect(bowlerRow).not.toContainText('OVERDUE');

  // --- Season Summary: team totals include the uncollected vacancy fee ---
  await page.getByRole('link', { name: 'Season Summary' }).click();
  const summaryTable = page.getByTestId('season-summary-table');
  await expect(summaryTable).toContainText('$36.00'); // Dues Due (bowler + vacancy)
  await expect(summaryTable).toContainText('$30.00'); // Dues Paid
  await expect(summaryTable).toContainText('League Total');
});
