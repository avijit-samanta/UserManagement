import { test, expect } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';

const data = testData as TestData;
const userRole = data.roles.find((role) => role.role === 'user')!;
const ticket = data.newTicket;

test.describe('Submit New Request (data-driven)', () => {
  test.use({ storageState: storageStatePath(userRole.storageStateFile) });

  test('creates a ticket from config data and shows it under My Tickets as open', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-new-request').click();

    // Use a unique title per run so the assertion below can't match a
    // leftover ticket from a previous test run.
    const uniqueTitle = `${ticket.title} ${Date.now()}`;

    await page.getByTestId('ticket-title-input').fill(uniqueTitle);
    await page.getByTestId('ticket-description-input').fill(ticket.description);
    await page.getByTestId('ticket-submit-button').click();

    await expect(page.getByText('Your request has been submitted to the administrator.')).toBeVisible();

    await page.getByTestId('nav-my-tickets').click();

    const row = page.locator('tr', { hasText: uniqueTitle });
    await expect(row).toBeVisible();
    await expect(row.getByText('open', { exact: true })).toBeVisible();
  });

  test('the ticket details dialog has a visible close button', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-new-request').click();

    const uniqueTitle = `${ticket.title} ${Date.now()}`;
    await page.getByTestId('ticket-title-input').fill(uniqueTitle);
    await page.getByTestId('ticket-description-input').fill(ticket.description);
    await page.getByTestId('ticket-submit-button').click();
    await expect(page.getByText('Your request has been submitted to the administrator.')).toBeVisible();

    await page.getByTestId('nav-my-tickets').click();
    await page.locator('tr', { hasText: uniqueTitle }).click();

    const dialog = page.getByRole('dialog', { name: 'Ticket details' });
    await expect(dialog).toBeVisible();

    await page.getByTestId('dialog-close-button').click();
    await expect(dialog).toHaveCount(0);
  });
});
