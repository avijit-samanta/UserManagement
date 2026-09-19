import { test, expect } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';

const data = testData as TestData;

// Deliberately doesn't reuse a saved storageState (unlike most other specs)
// — registration only makes sense from a logged-out session. Runs once per
// scenario in config/test-data.json's `registration` array, one per role.
test.describe('Self-registration (data-driven)', () => {
  for (const scenario of data.registration) {
    test(`registers a new ${scenario.role} account and lands on the ${scenario.role} dashboard`, async ({ page }) => {
      await page.goto('/register');

      // Unique per run so re-running the suite never collides with an
      // account created by a previous run.
      const uniqueEmail = `${scenario.emailPrefix}-${Date.now()}@example.com`;

      await page.getByTestId('register-name-input').fill(scenario.name);
      await page.getByTestId('register-email-input').fill(uniqueEmail);
      await page.getByTestId('register-password-input').fill(scenario.password);
      await page.getByTestId('register-confirm-password-input').fill(scenario.password);
      await page.getByTestId('register-phone-input').fill(scenario.phone);
      await page.getByTestId('register-address-input').fill(scenario.address);
      await page.getByTestId('register-role-select').selectOption(scenario.role);
      await page.getByTestId('register-submit-button').click();

      // A successful registration logs the new account in immediately and
      // redirects to /dashboard, same as a normal login.
      await expect(page.getByTestId(scenario.loginSuccessTestId)).toBeVisible();
    });
  }

  test('rejects registering with an email that already exists', async ({ page }) => {
    const existingAdmin = data.roles.find((r) => r.role === 'admin')!;

    await page.goto('/register');
    await page.getByTestId('register-name-input').fill('Duplicate Email Attempt');
    await page.getByTestId('register-email-input').fill(existingAdmin.credentials.email);
    await page.getByTestId('register-password-input').fill('SomePassword123');
    await page.getByTestId('register-confirm-password-input').fill('SomePassword123');
    await page.getByTestId('register-role-select').selectOption('user');
    await page.getByTestId('register-submit-button').click();

    await expect(page.getByTestId('register-error')).toBeVisible();
  });
});
