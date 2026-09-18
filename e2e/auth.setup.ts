import { test as setup, expect } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';

const data = testData as TestData;

// Logs in once per role defined in config/test-data.json and persists the
// authenticated session so downstream tests can reuse it via
// test.use({ storageState }) instead of logging in again.
for (const role of data.roles) {
  setup(`authenticate as ${role.label}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(role.credentials.email);
    await page.getByTestId('login-password-input').fill(role.credentials.password);
    await page.getByTestId('login-submit-button').click();

    await expect(page.getByTestId(role.loginSuccessTestId)).toBeVisible();

    await page.context().storageState({ path: storageStatePath(role.storageStateFile) });
  });
}
