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

test('the Schedule Board has a working Print Schedule action', async () => {
  // First-run setup creates the manager account and logs them straight in.
  await window.getByTestId('first-run-name').fill('Dana Manager');
  await window.getByTestId('first-run-username').fill('dana');
  await window.getByTestId('first-run-password').fill('supersecret1');
  await window.getByTestId('first-run-confirm-password').fill('supersecret1');
  await window.getByTestId('first-run-submit').click();
  await expect(window.getByRole('heading', { name: 'My Schedule' })).toBeVisible();

  await window.getByRole('link', { name: 'Schedule Board' }).click();
  await expect(window.getByRole('heading', { name: 'Schedule Board' })).toBeVisible();

  const printButton = window.getByTestId('print-schedule-button');
  await expect(printButton).toBeVisible();

  // Stub out window.print — this test only verifies the button wires up to
  // the native print pipeline, not what the OS print dialog itself does.
  // The print CSS/layout's actual output is verified separately by
  // rendering it to a PDF via webContents.printToPDF() (see the Milestone
  // 10 report), which a headless E2E click can't meaningfully assert on.
  await window.evaluate(() => {
    const target = globalThis as unknown as { __printCalled: boolean; print: () => void };
    target.__printCalled = false;
    target.print = () => {
      target.__printCalled = true;
    };
  });

  await printButton.click();

  const printCalled = await window.evaluate(
    () => (globalThis as unknown as { __printCalled: boolean }).__printCalled,
  );
  expect(printCalled).toBe(true);
});
