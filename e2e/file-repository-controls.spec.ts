import { test, expect, type Page } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';
import {
  createUser,
  deleteFiles,
  deleteUsers,
  signedInRequest,
  uniquePrefix,
  uploadFile,
  visible,
  visibleRows,
} from './support/api';

const data = testData as TestData;
const adminRole = data.roles.find((role) => role.role === 'admin')!;

const PAGE_SIZE = 20;
const rows = (page: Page) => visibleRows(page, 'file-repo-row-');

async function openFileRepository(page: Page) {
  await page.goto('/dashboard');
  await page.getByTestId('nav-file-repository').click();
  await expect(visible(page, 'file-repo-filters')).toBeVisible();
}

test.describe('File Repository: search, filters, sorting, pagination', () => {
  test.use({ storageState: storageStatePath(adminRole.storageStateFile) });

  test('search matches file name or topic; role, uploader and size filters narrow the list', async ({
    page,
    playwright,
    baseURL,
  }) => {
    const prefix = uniquePrefix('File filter check');
    // One small file from the admin, one larger file from a fresh user —
    // different on every filter axis.
    const user = await createUser(page.request, `${prefix} Uploader`);
    const userRequest = await signedInRequest(playwright, baseURL, user);
    const adminFile = await uploadFile(page.request, `${prefix} admin topic`, `${prefix}-admin.txt`, 64);
    await uploadFile(userRequest, `${prefix} user topic`, `${prefix}-user.txt`, 200 * 1024);

    try {
      await openFileRepository(page);
      const search = visible(page, 'file-repo-filter-search');

      await search.fill(prefix);
      await expect(rows(page)).toHaveCount(2);
      await search.fill(`${prefix} admin topic`);
      await expect(rows(page)).toHaveCount(1);
      await expect(visible(page, `file-repo-row-${adminFile}`)).toBeVisible();

      await search.fill(prefix);
      await visible(page, 'file-repo-filter-role').selectOption('user');
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText(`${prefix}-user.txt`);
      await visible(page, 'file-repo-filter-role').selectOption('all');

      await visible(page, 'file-repo-filter-uploader').selectOption({ label: user.name });
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText(`${prefix}-user.txt`);
      await visible(page, 'file-repo-filter-uploader').selectOption('all');

      const size = visible(page, 'file-repo-filter-size');
      await size.selectOption('small');
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText(`${prefix}-admin.txt`);
      await size.selectOption('medium');
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText(`${prefix}-user.txt`);
      await size.selectOption('large');
      await expect(visible(page, 'file-repo-filter-empty')).toBeVisible();

      await visible(page, 'file-repo-filter-clear').click();
      await expect(search).toHaveValue('');
      await expect(size).toHaveValue('all');
    } finally {
      await userRequest.dispose();
      await deleteFiles(page.request, [adminFile]);
      // Removes the user's file too.
      await deleteUsers(page.request, [user.id]);
    }
  });

  test('clicking the Size header sorts ascending, clicking again sorts descending', async ({ page }) => {
    const prefix = uniquePrefix('File sort check');
    const ids = [
      await uploadFile(page.request, prefix, `${prefix}-medium.txt`, 2000),
      await uploadFile(page.request, prefix, `${prefix}-small.txt`, 10),
      await uploadFile(page.request, prefix, `${prefix}-large.txt`, 5000),
    ];

    try {
      await openFileRepository(page);
      await visible(page, 'file-repo-filter-search').fill(prefix);
      await expect(rows(page)).toHaveCount(3);

      const names = rows(page).locator('td:nth-child(1)');
      await visible(page, 'file-repo-sort-size').click();
      await expect(names).toHaveText([`${prefix}-small.txt`, `${prefix}-medium.txt`, `${prefix}-large.txt`]);
      await visible(page, 'file-repo-sort-size').click();
      await expect(names).toHaveText([`${prefix}-large.txt`, `${prefix}-medium.txt`, `${prefix}-small.txt`]);
    } finally {
      await deleteFiles(page.request, ids);
    }
  });

  test(`shows at most ${PAGE_SIZE} rows per page with working Previous/Next`, async ({ page }) => {
    // 23 uploads + 23 deletes against the remote database and storage.
    test.slow();
    const prefix = uniquePrefix('File page check');
    const ids = await Promise.all(
      Array.from({ length: PAGE_SIZE + 3 }, (_, i) =>
        uploadFile(page.request, prefix, `${prefix}-${String(i + 1).padStart(2, '0')}.txt`),
      ),
    );

    try {
      await openFileRepository(page);
      await visible(page, 'file-repo-filter-search').fill(prefix);

      await expect(rows(page)).toHaveCount(PAGE_SIZE);
      await expect(visible(page, 'file-repo-pagination-summary')).toHaveText(
        `Showing 1–${PAGE_SIZE} of ${PAGE_SIZE + 3}`,
      );
      await expect(visible(page, 'file-repo-page-indicator')).toHaveText('Page 1 of 2');

      await visible(page, 'file-repo-page-next').click();
      await expect(rows(page)).toHaveCount(3);
      await expect(visible(page, 'file-repo-page-indicator')).toHaveText('Page 2 of 2');
      await expect(visible(page, 'file-repo-page-next')).toBeDisabled();
    } finally {
      await deleteFiles(page.request, ids);
    }
  });
});

test.describe('Dashboard layout', () => {
  test.use({ storageState: storageStatePath(adminRole.storageStateFile) });

  test('every section renders its card at the same position and width', async ({ page }) => {
    await page.goto('/dashboard');
    const boxes = [];
    for (const section of ['user-profiles', 'query-management', 'file-repository']) {
      await page.getByTestId(`nav-${section}`).click();
      const card = page.locator('[data-reach-tab-panel]:not([hidden]) .card').first();
      await expect(card).toBeVisible();
      const box = (await card.boundingBox())!;
      boxes.push({ section, x: Math.round(box.x), width: Math.round(box.width) });
    }
    for (const box of boxes) {
      expect(box, `${box.section} card`).toMatchObject({ x: boxes[0].x, width: boxes[0].width });
    }
  });
});
