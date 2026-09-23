import { test, expect } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';

const data = testData as TestData;
const adminRole = data.roles.find((role) => role.role === 'admin')!;

// Visual regression checks, on top of the functional assertions in the rest
// of the suite. A functional test only proves an element exists/works; it
// says nothing about whether it *looks* right (spacing, alignment, sizing).
// These compare a screenshot of a stable, data-independent region against a
// checked-in baseline (`*-snapshots/`, generated on first run — see the
// README's "Visual Regression Testing" section) and fail the test if pixels
// drift beyond the default threshold.
//
// Scoped to `.auth-card` / `.side-nav` rather than the full page: full-page
// screenshots of this app would also capture ticket tables, timestamps, and
// other rows written by other data-driven tests in this suite, which change
// from run to run and would make the comparison flaky for reasons that have
// nothing to do with a real visual regression.
test.describe('Visual regression checks', () => {
  test('login page matches its visual baseline', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-submit-button')).toBeVisible();

    await expect(page.locator('.auth-card')).toHaveScreenshot('login-baseline.png');
  });

  test.describe('dashboard navigation', () => {
    test.use({ storageState: storageStatePath(adminRole.storageStateFile) });

    test("admin dashboard's side navigation matches its visual baseline", async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByTestId('nav-user-profiles')).toBeVisible();

      await expect(page.locator('.side-nav')).toHaveScreenshot('dashboard-nav-baseline.png');
    });
  });

  // Demonstrates that the checks above actually catch a regression, instead
  // of just passing because nothing has ever changed. Skipped by default so
  // this intentionally-failing test never blocks a normal run or CI; opt in
  // with VISUAL_DIFF_DEMO=1 to see Playwright flag the simulated layout
  // change and produce a diff in the HTML report (see the README).
  test('detects a simulated visual regression on the login page', async ({ page }) => {
    test.skip(!process.env.VISUAL_DIFF_DEMO, 'Set VISUAL_DIFF_DEMO=1 to run this intentionally-failing demo.');

    await page.goto('/login');
    await expect(page.getByTestId('login-submit-button')).toBeVisible();

    // Simulate a UI regression without touching app source: nudge the
    // submit button and enlarge the heading, purely from within the test.
    await page.addStyleTag({
      content: `
        [data-testid="login-submit-button"] { margin-top: 50px; transform: scale(1.15); }
        .auth-heading { font-size: 32px; }
      `,
    });

    await expect(page.locator('.auth-card')).toHaveScreenshot('login-baseline.png');
  });
});
