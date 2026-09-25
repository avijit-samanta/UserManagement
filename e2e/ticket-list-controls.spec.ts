import { test, expect, type Page } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';
import {
  createTicket,
  createUser,
  deleteTickets,
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
const rows = (page: Page) => visibleRows(page, 'ticket-row-');

async function openMyTickets(page: Page) {
  await page.goto('/dashboard');
  await page.getByTestId('nav-my-tickets').click();
  await expect(visible(page, 'ticket-filters')).toBeVisible();
}

test.describe('My Tickets: search, filters, sorting, pagination, delete', () => {
  test.use({ storageState: storageStatePath(userRole.storageStateFile) });

  test('search matches by ticket ID and by title; status and date filters narrow the list', async ({ page }) => {
    const title = uniquePrefix('Filter check');
    const id = await createTicket(page.request, title);

    try {
      await openMyTickets(page);
      const search = visible(page, 'ticket-filter-search');

      await search.fill(title);
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText(id);

      await search.fill(id);
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText(title);

      // A brand-new ticket is "open", so filtering on "closed" hides it.
      const status = visible(page, 'ticket-filter-status');
      await status.selectOption('closed');
      await expect(visible(page, 'ticket-filter-empty')).toBeVisible();
      await status.selectOption('open');
      await expect(rows(page)).toHaveCount(1);

      // Updated today, so "from tomorrow" excludes it.
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const tomorrowValue = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
      await visible(page, 'ticket-filter-date-from').fill(tomorrowValue);
      await expect(visible(page, 'ticket-filter-empty')).toBeVisible();

      await visible(page, 'ticket-filter-clear').click();
      await expect(search).toHaveValue('');
      await expect(visible(page, `ticket-row-${id}`)).toBeVisible();
    } finally {
      await deleteTickets(page.request, [id]);
    }
  });

  test('a normal user does not get the submitter filter', async ({ page }) => {
    const id = await createTicket(page.request, uniquePrefix('No submitter filter check'));
    try {
      await openMyTickets(page);
      await expect(page.getByTestId('ticket-filter-submitter')).toHaveCount(0);
    } finally {
      await deleteTickets(page.request, [id]);
    }
  });

  test('clicking a column header sorts ascending, clicking again sorts descending', async ({ page }) => {
    const prefix = uniquePrefix('Sort check');
    const ids = [
      await createTicket(page.request, `${prefix} B`),
      await createTicket(page.request, `${prefix} A`),
      await createTicket(page.request, `${prefix} C`),
    ];

    try {
      await openMyTickets(page);
      await visible(page, 'ticket-filter-search').fill(prefix);
      await expect(rows(page)).toHaveCount(3);

      const titleHeader = visible(page, 'ticket-sort-title');
      await titleHeader.click();
      await expect(rows(page).locator('td:nth-child(2)')).toHaveText([`${prefix} A`, `${prefix} B`, `${prefix} C`]);
      await expect(page.locator('th[aria-sort="ascending"]').filter({ visible: true })).toContainText('Title');

      await titleHeader.click();
      await expect(rows(page).locator('td:nth-child(2)')).toHaveText([`${prefix} C`, `${prefix} B`, `${prefix} A`]);
      await expect(page.locator('th[aria-sort="descending"]').filter({ visible: true })).toContainText('Title');
    } finally {
      await deleteTickets(page.request, ids);
    }
  });

  test(`shows at most ${PAGE_SIZE} rows per page with working Previous/Next`, async ({ page }) => {
    // 23 creates + 23 deletes against the remote database.
    test.slow();
    const prefix = uniquePrefix('Page check');
    // Enough of our own tickets for two pages, regardless of what else the
    // account already has — the search below isolates exactly these.
    const ids = await Promise.all(
      Array.from({ length: PAGE_SIZE + 3 }, (_, i) =>
        createTicket(page.request, `${prefix} #${String(i + 1).padStart(2, '0')}`),
      ),
    );

    try {
      await openMyTickets(page);
      await visible(page, 'ticket-filter-search').fill(prefix);

      const summary = visible(page, 'ticket-pagination-summary');
      const indicator = visible(page, 'ticket-page-indicator');
      const prev = visible(page, 'ticket-page-prev');
      const next = visible(page, 'ticket-page-next');

      await expect(rows(page)).toHaveCount(PAGE_SIZE);
      await expect(summary).toHaveText(`Showing 1–${PAGE_SIZE} of ${PAGE_SIZE + 3}`);
      await expect(indicator).toHaveText('Page 1 of 2');
      await expect(prev).toBeDisabled();

      await next.click();
      await expect(rows(page)).toHaveCount(3);
      await expect(summary).toHaveText(`Showing ${PAGE_SIZE + 1}–${PAGE_SIZE + 3} of ${PAGE_SIZE + 3}`);
      await expect(indicator).toHaveText('Page 2 of 2');
      await expect(next).toBeDisabled();

      await prev.click();
      await expect(indicator).toHaveText('Page 1 of 2');
    } finally {
      await deleteTickets(page.request, ids);
    }
  });

  test('a normal user can delete their own ticket from its row', async ({ page }) => {
    const title = uniquePrefix('Delete check');
    const id = await createTicket(page.request, title);

    try {
      await openMyTickets(page);
      await visible(page, 'ticket-filter-search').fill(title);
      await expect(rows(page)).toHaveCount(1);

      page.once('dialog', (dialog) => dialog.accept());
      await visible(page, `ticket-delete-${id}`).click();

      await expect(page.getByTestId(`ticket-row-${id}`)).toHaveCount(0);
      // The row click must not have opened the details dialog as well.
      await expect(page.getByRole('dialog', { name: 'Ticket details' })).toHaveCount(0);
      expect((await page.request.get(`/api/tickets/${id}`)).status()).toBe(404);
    } finally {
      await deleteTickets(page.request, [id]);
    }
  });

  test('dismissing the confirmation keeps the ticket', async ({ page }) => {
    const title = uniquePrefix('Delete cancel check');
    const id = await createTicket(page.request, title);

    try {
      await openMyTickets(page);
      await visible(page, 'ticket-filter-search').fill(title);

      page.once('dialog', (dialog) => dialog.dismiss());
      await visible(page, `ticket-delete-${id}`).click();

      await expect(visible(page, `ticket-row-${id}`)).toBeVisible();
      expect((await page.request.get(`/api/tickets/${id}`)).status()).toBe(200);
    } finally {
      await deleteTickets(page.request, [id]);
    }
  });
});

test.describe('Query Management: submitter filter and admin delete', () => {
  test.use({ storageState: storageStatePath(adminRole.storageStateFile) });

  test('the "Submitted by" filter shows only that user\'s tickets', async ({ page, playwright, baseURL }) => {
    const prefix = uniquePrefix('Submitter check');
    // Two fresh submitters, so the filter has something to tell apart.
    const alice = await createUser(page.request, `${prefix} Alice`);
    const bob = await createUser(page.request, `${prefix} Bob`);
    const aliceRequest = await signedInRequest(playwright, baseURL, alice);
    const bobRequest = await signedInRequest(playwright, baseURL, bob);

    try {
      const aliceTicket = await createTicket(aliceRequest, `${prefix} from Alice`);
      const bobTicket = await createTicket(bobRequest, `${prefix} from Bob`);

      await page.goto('/dashboard');
      await page.getByTestId('nav-query-management').click();
      await visible(page, 'ticket-filter-search').fill(prefix);
      await expect(rows(page)).toHaveCount(2);

      const submitter = visible(page, 'ticket-filter-submitter');
      await submitter.selectOption({ label: alice.name });
      await expect(rows(page)).toHaveCount(1);
      await expect(visible(page, `ticket-row-${aliceTicket}`)).toBeVisible();

      await submitter.selectOption({ label: bob.name });
      await expect(rows(page)).toHaveCount(1);
      await expect(visible(page, `ticket-row-${bobTicket}`)).toBeVisible();

      await submitter.selectOption('all');
      await expect(rows(page)).toHaveCount(2);
    } finally {
      await Promise.all([aliceRequest.dispose(), bobRequest.dispose()]);
      // Deleting the users removes their tickets too.
      await deleteUsers(page.request, [alice.id, bob.id]);
    }
  });

  test("the admin can delete a normal user's ticket", async ({ page, playwright, baseURL }) => {
    const userRequest = await playwright.request.newContext({
      baseURL,
      storageState: storageStatePath(userRole.storageStateFile),
    });
    const title = uniquePrefix('Admin delete check');
    const id = await createTicket(userRequest, title);

    try {
      await page.goto('/dashboard');
      await page.getByTestId('nav-query-management').click();
      await visible(page, 'ticket-filter-search').fill(title);
      await expect(rows(page)).toHaveCount(1);

      page.once('dialog', (dialog) => dialog.accept());
      await visible(page, `ticket-delete-${id}`).click();

      await expect(page.getByTestId(`ticket-row-${id}`)).toHaveCount(0);
      expect((await userRequest.get(`/api/tickets/${id}`)).status()).toBe(404);
    } finally {
      await deleteTickets(userRequest, [id]);
      await userRequest.dispose();
    }
  });

  test("API: a normal user cannot delete someone else's ticket", async ({ page, playwright, baseURL }) => {
    // The seeded admin can't submit tickets, so "someone else's" is a
    // ticket owned by a second, freshly created normal user.
    const other = await createUser(page.request, uniquePrefix('Delete guard'));
    const otherRequest = await signedInRequest(playwright, baseURL, other);
    const userRequest = await playwright.request.newContext({
      baseURL,
      storageState: storageStatePath(userRole.storageStateFile),
    });

    try {
      const id = await createTicket(otherRequest, uniquePrefix('Other user ticket'));
      expect((await userRequest.delete(`/api/tickets/${id}`)).status()).toBe(403);
      expect((await otherRequest.get(`/api/tickets/${id}`)).status()).toBe(200);
    } finally {
      await Promise.all([otherRequest.dispose(), userRequest.dispose()]);
      await deleteUsers(page.request, [other.id]);
    }
  });
});
