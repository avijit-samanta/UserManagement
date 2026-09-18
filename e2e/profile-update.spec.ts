import { test, expect } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';

const data = testData as TestData;
const userRole = data.roles.find((role) => role.role === 'user')!;
const profile = data.profileUpdate.user;

test.describe('My Profile — update & save (data-driven)', () => {
  test.use({ storageState: storageStatePath(userRole.storageStateFile) });

  test('saves profile field values from config and persists them after reload', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-my-profile').click();

    await page.getByTestId('profile-name-input').fill(profile.name);
    await page.getByTestId('profile-email-input').fill(profile.email);
    await page.getByTestId('profile-phone-input').fill(profile.phone);
    await page.getByTestId('profile-address-input').fill(profile.address);
    await page.getByTestId('profile-save-button').click();

    await expect(page.getByText('Profile saved successfully.')).toBeVisible();

    // Reload to confirm the values were actually persisted server-side,
    // not just held in local component state.
    await page.reload();
    await page.getByTestId('nav-my-profile').click();

    await expect(page.getByTestId('profile-name-input')).toHaveValue(profile.name);
    await expect(page.getByTestId('profile-phone-input')).toHaveValue(profile.phone);
    await expect(page.getByTestId('profile-address-input')).toHaveValue(profile.address);
  });
});
