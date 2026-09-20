import { test, expect } from '@playwright/test';
import testData from './config/test-data.json';
import type { TestData } from './config/types';
import { storageStatePath } from './config/storage-state';

const data = testData as TestData;
const userRole = data.roles.find((role) => role.role === 'user')!;
const adminRole = data.roles.find((role) => role.role === 'admin')!;
const { ticket, adminReply, repositoryUpload } = data.fileAttachments;

// setInputFiles accepts an in-memory buffer, so these tests don't depend on
// any fixture file existing on disk.
function fakeFile(name: string, content: string) {
  return { name, mimeType: 'text/plain', buffer: Buffer.from(content) };
}

test.describe('File attachments: tickets, replies, and the File Repository', () => {
  test.use({ storageState: storageStatePath(userRole.storageStateFile) });

  test('a file attached when submitting a ticket appears on the ticket and in the File Repository', async ({ page }) => {
    const uniqueTitle = `${ticket.title} ${Date.now()}`;
    // A unique filename too — the same physical file input testid also
    // exists (hidden) on every other tab Reach UI keeps mounted, and dev
    // runs accumulate rows across repeated test runs, so a generic name
    // like "proof.txt" risks matching more than one row.
    const fileName = `proof-${Date.now()}.txt`;

    await page.goto('/dashboard');
    await page.getByTestId('nav-new-request').click();
    await page.getByTestId('ticket-title-input').fill(uniqueTitle);
    await page.getByTestId('ticket-description-input').fill(ticket.description);
    await page.getByTestId('ticket-attach-input').setInputFiles(fakeFile(fileName, 'evidence of the bug'));
    await page.getByTestId('ticket-submit-button').click();
    await expect(page.getByText('Your request has been submitted to the administrator.')).toBeVisible();

    // Visible on the ticket itself. Scoped to the "ticket-row-" prefix, not
    // a bare `tr`, since Reach UI's Tabs keep every panel — including File
    // Repository, whose Topic column also shows this same unique title —
    // mounted at once, and both use a plain <tr> for their rows.
    await page.getByTestId('nav-my-tickets').click();
    await page.locator('[data-testid^="ticket-row-"]', { hasText: uniqueTitle }).click();
    await expect(page.getByTestId('attachment-download-link').filter({ hasText: fileName })).toBeVisible();
    await page.keyboard.press('Escape');

    // Also visible in the standalone File Repository section, with the
    // ticket's title used automatically as the Topic column.
    await page.getByTestId('nav-file-repository').click();
    const row = page.locator('[data-testid^="file-repo-row-"]', { hasText: fileName });
    await expect(row).toBeVisible();
    await expect(row).toContainText(uniqueTitle);
  });

  test('a file the admin attaches to a reply shows up under that message and is downloadable by the submitter', async ({
    page,
    browser,
  }) => {
    const uniqueTitle = `${ticket.title} ${Date.now()}`;
    const fileName = `fix-steps-${Date.now()}.txt`;

    await page.goto('/dashboard');
    await page.getByTestId('nav-new-request').click();
    await page.getByTestId('ticket-title-input').fill(uniqueTitle);
    await page.getByTestId('ticket-description-input').fill(ticket.description);
    await page.getByTestId('ticket-submit-button').click();
    await expect(page.getByText('Your request has been submitted to the administrator.')).toBeVisible();

    const adminContext = await browser.newContext({ storageState: storageStatePath(adminRole.storageStateFile) });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/dashboard');
    await adminPage.getByTestId('nav-query-management').click();
    await adminPage.locator('[data-testid^="ticket-row-"]', { hasText: uniqueTitle }).click();

    await adminPage.getByTestId('ticket-respond-textarea').fill(adminReply);
    await adminPage.getByTestId('ticket-respond-attach-input').setInputFiles(fakeFile(fileName, 'try this first'));
    await adminPage.getByTestId('ticket-respond-button').click();

    const adminMessage = adminPage.getByTestId('ticket-message').filter({ hasText: adminReply });
    await expect(adminMessage).toBeVisible();
    await expect(adminMessage.getByTestId('attachment-download-link')).toContainText(fileName);
    await adminContext.close();

    // The submitter sees the admin's file attached to that specific reply,
    // and it appears in their own File Repository too (an admin-uploaded
    // file on their own ticket is visible to them).
    await page.reload();
    await page.getByTestId('nav-my-tickets').click();
    await page.locator('[data-testid^="ticket-row-"]', { hasText: uniqueTitle }).click();
    const userSideMessage = page.getByTestId('ticket-message').filter({ hasText: adminReply });
    await expect(userSideMessage.getByTestId('attachment-download-link')).toContainText(fileName);
    await page.keyboard.press('Escape');

    await page.getByTestId('nav-file-repository').click();
    const repoRow = page.locator('[data-testid^="file-repo-row-"]', { hasText: fileName });
    await expect(repoRow).toBeVisible();
    await expect(repoRow).toContainText('Alex Administrator');
  });

  test('uploading directly into the File Repository ("Upload More") requires a topic and is visible immediately', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-file-repository').click();

    const uniqueTopic = `${repositoryUpload.topic} ${Date.now()}`;
    const fileName = `standalone-${Date.now()}.txt`;

    await page.getByTestId('file-repo-file-input').setInputFiles(fakeFile(fileName, 'a standalone repository file'));
    await page.getByTestId('file-repo-upload-button').click();
    // No topic yet — the client requires it via the "required" attribute,
    // so nothing should have been sent; asserting the row never appears
    // catches a regression that silently drops that requirement.
    await expect(page.locator(`[data-testid^="file-repo-row-"]:has-text("${fileName}")`)).toHaveCount(0);

    await page.getByTestId('file-repo-topic-input').fill(uniqueTopic);
    await page.getByTestId('file-repo-upload-button').click();
    await expect(page.getByText('File(s) uploaded to the repository.')).toBeVisible();

    const row = page.locator('[data-testid^="file-repo-row-"]', { hasText: fileName });
    await expect(row).toBeVisible();
    await expect(row).toContainText(uniqueTopic);

    // The uploader can delete their own file.
    const deleteButton = row.getByRole('button', { name: /delete/i });
    await deleteButton.click();
    await expect(row).toHaveCount(0);
  });

  test("a normal user's File Repository never shows another user's unrelated file", async ({ page, browser }) => {
    const uniqueTopic = `Isolation check ${Date.now()}`;
    const fileName = `private-${Date.now()}.txt`;

    // Admin uploads a repository-only file with no connection to this
    // user's tickets.
    const adminContext = await browser.newContext({ storageState: storageStatePath(adminRole.storageStateFile) });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/dashboard');
    await adminPage.getByTestId('nav-file-repository').click();
    await adminPage.getByTestId('file-repo-file-input').setInputFiles(fakeFile(fileName, 'admin-only content'));
    await adminPage.getByTestId('file-repo-topic-input').fill(uniqueTopic);
    await adminPage.getByTestId('file-repo-upload-button').click();
    await expect(adminPage.getByText('File(s) uploaded to the repository.')).toBeVisible();
    await adminContext.close();

    await page.goto('/dashboard');
    await page.getByTestId('nav-file-repository').click();
    await expect(page.locator(`[data-testid^="file-repo-row-"]:has-text("${fileName}")`)).toHaveCount(0);
  });
});
