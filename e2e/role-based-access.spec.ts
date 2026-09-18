import { test, expect } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';

const data = testData as TestData;

// Generates one describe block per role listed in config/test-data.json.
// Adding a new role (or changing which nav items/API checks belong to an
// existing one) only requires editing that JSON file — no test code changes.
for (const role of data.roles) {
  test.describe(`${role.label} role-based access`, () => {
    // Reuses the session captured by e2e/auth.setup.ts — no login step here.
    test.use({ storageState: storageStatePath(role.storageStateFile) });

    test(`sees only ${role.label} dashboard features`, async ({ page }) => {
      await page.goto('/dashboard');

      for (const testId of role.expectedVisibleNavTestIds) {
        await expect(page.getByTestId(testId)).toBeVisible();
      }

      for (const testId of role.expectedAbsentNavTestIds) {
        await expect(page.getByTestId(testId)).toHaveCount(0);
      }
    });

    for (const apiCheck of role.apiChecks) {
      test(`API: ${apiCheck.description}`, async ({ page }) => {
        await page.goto('/dashboard');
        const response = await page.request.get(apiCheck.endpoint);
        expect(response.status()).toBe(apiCheck.expectedStatus);
      });
    }
  });
}
