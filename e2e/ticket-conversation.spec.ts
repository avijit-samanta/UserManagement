import { test, expect } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';

const data = testData as TestData;
const userRole = data.roles.find((role) => role.role === 'user')!;
const adminRole = data.roles.find((role) => role.role === 'admin')!;
const conversation = data.ticketConversation;

// Covers the full lifecycle added on top of the original single-response
// model: both the admin AND the ticket's own submitter can send as many
// messages as they like on the same ticket (a genuine two-way thread, not
// just admin -> user), the admin can close it once resolved, and the
// original submitter can reopen it. Runs as one user (page fixture) and
// switches to a second, independent browser context for the admin half — a
// fresh context, not a role reused via test.use(), because both roles have
// to act within the same test.
test.describe('Ticket conversation: multiple messages, close, and reopen', () => {
  test.use({ storageState: storageStatePath(userRole.storageStateFile) });

  test('admin and user exchange multiple messages; admin closes; the submitter reopens', async ({
    page,
    browser,
  }) => {
    const uniqueTitle = `${conversation.title} ${Date.now()}`;

    // 1. User submits the ticket.
    await page.goto('/dashboard');
    await page.getByTestId('nav-new-request').click();
    await page.getByTestId('ticket-title-input').fill(uniqueTitle);
    await page.getByTestId('ticket-description-input').fill(conversation.description);
    await page.getByTestId('ticket-submit-button').click();
    await expect(page.getByText('Your request has been submitted to the administrator.')).toBeVisible();

    // 2. Admin, in an independent browser context, opens the ticket and
    // sends every message configured in test-data.json.
    const adminContext = await browser.newContext({ storageState: storageStatePath(adminRole.storageStateFile) });
    const adminPage = await adminContext.newPage();

    await adminPage.goto('/dashboard');
    await adminPage.getByTestId('nav-query-management').click();
    await adminPage.locator('tr', { hasText: uniqueTitle }).click();

    for (const message of conversation.adminMessages) {
      await adminPage.getByTestId('ticket-respond-textarea').fill(message);
      await adminPage.getByTestId('ticket-respond-button').click();
      await expect(adminPage.getByTestId('ticket-message').filter({ hasText: message })).toBeVisible();
    }
    await expect(adminPage.getByTestId('ticket-message')).toHaveCount(conversation.adminMessages.length);
    await expect(adminPage.locator('.app-dialog-content .status-badge')).toHaveText('answered');

    // 3. The submitter replies from their own session — this is the new
    // capability: a normal user can append to the thread too, not just read
    // the admin's response. Replying moves the ticket back to "open" since
    // it needs the admin's attention again.
    await page.goto('/dashboard');
    await page.getByTestId('nav-my-tickets').click();
    await page.locator('tr', { hasText: uniqueTitle }).click();
    await page.getByTestId('ticket-respond-textarea').fill(conversation.userReply);
    await page.getByTestId('ticket-respond-button').click();
    await expect(page.getByTestId('ticket-message').filter({ hasText: conversation.userReply })).toBeVisible();
    await expect(page.locator('.app-dialog-content .status-badge')).toHaveText('open');
    // The user's own view has no close button — only admins can close a ticket.
    await expect(page.getByTestId('ticket-close-button')).toHaveCount(0);

    // 4. Back on the admin side, the new message is visible and the admin closes the ticket.
    // A reload resets Reach UI's Tabs to the first tab ("User Profiles"),
    // so Query Management has to be reselected before its (still-mounted
    // but now hidden) ticket row is visible/clickable again.
    await adminPage.reload();
    await adminPage.getByTestId('nav-query-management').click();
    await adminPage.locator('tr', { hasText: uniqueTitle }).click();
    await expect(adminPage.getByTestId('ticket-message').filter({ hasText: conversation.userReply })).toBeVisible();
    await expect(adminPage.getByTestId('ticket-message')).toHaveCount(conversation.adminMessages.length + 1);

    await adminPage.getByTestId('ticket-close-button').click();
    await expect(adminPage.locator('.app-dialog-content .status-badge')).toHaveText('closed');
    // The respond form and close button only render while a ticket isn't
    // closed — confirms the "can't respond to a closed ticket" rule holds
    // in the UI too, not just the API guard in server/src/routes/tickets.ts.
    await expect(adminPage.getByTestId('ticket-respond-button')).toHaveCount(0);

    await adminContext.close();

    // 5. Back as the original submitter: the ticket shows closed, and only
    // the submitter can reopen it.
    await page.goto('/dashboard');
    await page.getByTestId('nav-my-tickets').click();
    await page.locator('tr', { hasText: uniqueTitle }).click();
    await expect(page.locator('.app-dialog-content .status-badge')).toHaveText('closed');

    await page.getByTestId('ticket-reopen-button').click();
    await expect(page.locator('.app-dialog-content .status-badge')).toHaveText('open');
  });
});
