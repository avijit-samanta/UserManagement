import { test, expect, type Page } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';
import {
  createTicket,
  createUser,
  deleteUsers,
  signedInRequest,
  uniquePrefix,
  visible,
  visibleRows,
} from './support/api';

const data = testData as TestData;
const userRole = data.roles.find((role) => role.role === 'user')!;
const adminRole = data.roles.find((role) => role.role === 'admin')!;

const PAGE_SIZE = 20;
const rows = (page: Page) => visibleRows(page, 'user-row-');

async function openUserProfiles(page: Page) {
  await page.goto('/dashboard');
  await page.getByTestId('nav-user-profiles').click();
  await expect(visible(page, 'user-filters')).toBeVisible();
}

test.describe('User Profiles: search, role filter, sorting, pagination, delete', () => {
  test.use({ storageState: storageStatePath(adminRole.storageStateFile) });

  test('search matches name or email; the role filter narrows the list', async ({ page }) => {
    const user = await createUser(page.request, uniquePrefix('Role filter check'));

    try {
      await openUserProfiles(page);
      const search = visible(page, 'user-filter-search');

      await search.fill(user.name);
      await expect(rows(page)).toHaveCount(1);
      await search.fill(user.email);
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText(user.name);

      const role = visible(page, 'user-filter-role');
      await role.selectOption('admin');
      await expect(visible(page, 'user-filter-empty')).toBeVisible();
      await role.selectOption('user');
      await expect(rows(page)).toHaveCount(1);

      await visible(page, 'user-filter-clear').click();
      await expect(search).toHaveValue('');
      await expect(role).toHaveValue('all');
    } finally {
      await deleteUsers(page.request, [user.id]);
    }
  });

  test('the role filter on its own shows only that role', async ({ page }) => {
    await openUserProfiles(page);
    await visible(page, 'user-filter-role').selectOption('admin');
    await expect(rows(page).first()).toBeVisible();
    await expect(rows(page).locator('td:nth-child(3)').filter({ hasText: /^user$/i })).toHaveCount(0);
    await expect(rows(page).filter({ hasText: adminRole.credentials.email })).toHaveCount(1);
  });

  test('clicking a column header sorts ascending, clicking again sorts descending', async ({ page }) => {
    const prefix = uniquePrefix('Sort user');
    const users = [
      await createUser(page.request, `${prefix} B`),
      await createUser(page.request, `${prefix} A`),
      await createUser(page.request, `${prefix} C`),
    ];

    try {
      await openUserProfiles(page);
      await visible(page, 'user-filter-search').fill(prefix);
      await expect(rows(page)).toHaveCount(3);

      const nameHeader = visible(page, 'user-sort-name');
      await nameHeader.click();
      await expect(rows(page).locator('td:nth-child(1)')).toHaveText([`${prefix} A`, `${prefix} B`, `${prefix} C`]);
      await nameHeader.click();
      await expect(rows(page).locator('td:nth-child(1)')).toHaveText([`${prefix} C`, `${prefix} B`, `${prefix} A`]);
    } finally {
      await deleteUsers(
        page.request,
        users.map((u) => u.id),
      );
    }
  });

  test(`shows at most ${PAGE_SIZE} rows per page with working Previous/Next`, async ({ page }) => {
    // 23 creates + 23 deletes against the remote database.
    test.slow();
    const prefix = uniquePrefix('Page user');
    const users = await Promise.all(
      Array.from({ length: PAGE_SIZE + 3 }, (_, i) =>
        createUser(page.request, `${prefix} ${String(i + 1).padStart(2, '0')}`),
      ),
    );

    try {
      await openUserProfiles(page);
      await visible(page, 'user-filter-search').fill(prefix);

      await expect(rows(page)).toHaveCount(PAGE_SIZE);
      await expect(visible(page, 'user-pagination-summary')).toHaveText(`Showing 1–${PAGE_SIZE} of ${PAGE_SIZE + 3}`);
      await expect(visible(page, 'user-page-indicator')).toHaveText('Page 1 of 2');
      await expect(visible(page, 'user-page-prev')).toBeDisabled();

      await visible(page, 'user-page-next').click();
      await expect(rows(page)).toHaveCount(3);
      await expect(visible(page, 'user-page-indicator')).toHaveText('Page 2 of 2');
      await expect(visible(page, 'user-page-next')).toBeDisabled();
    } finally {
      await deleteUsers(
        page.request,
        users.map((u) => u.id),
      );
    }
  });

  test('the admin can delete a user, which also removes their tickets', async ({ page, playwright, baseURL }) => {
    const user = await createUser(page.request, uniquePrefix('Delete user check'));
    const userRequest = await signedInRequest(playwright, baseURL, user);

    try {
      const ticketId = await createTicket(userRequest, uniquePrefix('Ticket of deleted user'));

      await openUserProfiles(page);
      await visible(page, 'user-filter-search').fill(user.email);
      await expect(rows(page)).toHaveCount(1);

      page.once('dialog', (dialog) => dialog.accept());
      await visible(page, `user-delete-${user.id}`).click();

      await expect(page.getByTestId(`user-row-${user.id}`)).toHaveCount(0);
      // The row click must not have opened the profile editor as well.
      await expect(page.getByRole('dialog', { name: 'Edit user profile' })).toHaveCount(0);
      expect((await page.request.get(`/api/users/${user.id}`)).status()).toBe(404);
      expect((await page.request.get(`/api/tickets/${ticketId}`)).status()).toBe(404);
      // Their existing session no longer authenticates.
      expect((await userRequest.get('/api/tickets')).status()).toBe(401);
    } finally {
      await userRequest.dispose();
      await deleteUsers(page.request, [user.id]);
    }
  });

  test("the signed-in admin's own row has no Delete button, and the API refuses self-deletion", async ({ page }) => {
    await openUserProfiles(page);
    await visible(page, 'user-filter-search').fill(adminRole.credentials.email);
    const ownRow = rows(page).filter({ hasText: adminRole.credentials.email });
    await expect(ownRow).toHaveCount(1);
    await expect(ownRow.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    const me = await (await page.request.get('/api/auth/me')).json();
    expect((await page.request.delete(`/api/users/${me.user.id}`)).status()).toBe(400);
  });
});

test.describe('User Profiles: delete is admin-only', () => {
  test.use({ storageState: storageStatePath(userRole.storageStateFile) });

  test('API: a normal user cannot delete accounts', async ({ page }) => {
    const me = await (await page.request.get('/api/auth/me')).json();
    expect((await page.request.delete(`/api/users/${me.user.id}`)).status()).toBe(403);
  });
});
