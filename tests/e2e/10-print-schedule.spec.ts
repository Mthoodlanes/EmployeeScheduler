import { expect, test } from '@playwright/test';
import { loginAsManager } from './helpers.js';

/**
 * Milestone 24: ported from the deleted `tests/e2e/print-schedule.spec.ts`.
 * No employee/entity data is created here, so no `uniqueName()` adaptation is
 * needed — this only exercises the Schedule Board's Print Schedule button,
 * which is manager-global rather than data-scoped.
 */
test('the Schedule Board has a working Print Schedule action', async ({ page }) => {
  await loginAsManager(page);

  await page.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  const printButton = page.getByTestId('print-schedule-button');
  await expect(printButton).toBeVisible();

  // Stub out window.print — this test only verifies the button wires up to
  // the browser's native print pipeline, not what the OS print dialog itself
  // does or what the print CSS/layout actually renders.
  await page.evaluate(() => {
    const target = globalThis as unknown as { __printCalled: boolean; print: () => void };
    target.__printCalled = false;
    target.print = () => {
      target.__printCalled = true;
    };
  });

  await printButton.click();

  const printCalled = await page.evaluate(
    () => (globalThis as unknown as { __printCalled: boolean }).__printCalled,
  );
  expect(printCalled).toBe(true);
});
