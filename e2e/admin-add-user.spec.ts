import { test, expect } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';
import { deleteUsers } from './support/api';

const data = testData as TestData;
const adminRole = data.roles.find((role) => role.role === 'admin')!;
const newUser = data.adminAddUser;

test.describe('Admin: add a new user directly', () => {
  test.use({ storageState: storageStatePath(adminRole.storageStateFile) });

  test('creates a user account without them self-registering, and it appears in User Profiles', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-user-profiles').click();
    await page.getByTestId('open-add-user-button').click();

    const uniqueEmail = `qa-added-${Date.now()}@example.com`;

    await page.getByTestId('add-user-name-input').fill(newUser.name);
    await page.getByTestId('add-user-email-input').fill(uniqueEmail);
    await page.getByTestId('add-user-password-input').fill(newUser.password);
    await page.getByTestId('add-user-phone-input').fill(newUser.phone);
    await page.getByTestId('add-user-address-input').fill(newUser.address);
    await page.getByTestId('add-user-role-select').selectOption(newUser.role);
    await page.getByTestId('add-user-submit-button').click();

    try {
      // New users are appended to a paginated list (20 per page), so search
      // rather than assume the row is on the page currently shown.
      await page.getByTestId('user-filter-search').filter({ visible: true }).fill(uniqueEmail);
      await expect(page.locator('tr', { hasText: uniqueEmail })).toBeVisible();
    } finally {
      // Don't leave a new account in the real database on every run.
      const { users } = await (await page.request.get('/api/users')).json();
      const created = users.find((u: { email: string }) => u.email === uniqueEmail);
      if (created) await deleteUsers(page.request, [created.id]);
    }
  });
});
