import { expect, type APIRequestContext, type Page, type PlaywrightWorkerArgs } from '@playwright/test';

// API shortcuts for setting up and tearing down test data. The UI flows
// these replace (submit form, add-user dialog) have their own specs; here
// they just need to be fast and leave nothing behind in the real database.

export const TEST_TICKET_DESCRIPTION = 'Created by the Playwright list-controls suite';

// Unique per test (and per browser project/worker, since the suite runs
// fully parallel against the same database) so assertions never match
// data another test created.
export function uniquePrefix(label: string): string {
  return `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createTicket(request: APIRequestContext, title: string): Promise<string> {
  const response = await request.post('/api/tickets', { data: { title, description: TEST_TICKET_DESCRIPTION } });
  expect(response.status()).toBe(201);
  return (await response.json()).ticket.id as string;
}

// 404 is fine: the test itself may already have deleted it.
export async function deleteTickets(request: APIRequestContext, ids: string[]) {
  const statuses = await Promise.all(ids.map(async (id) => (await request.delete(`/api/tickets/${id}`)).status()));
  for (const status of statuses) expect([204, 404]).toContain(status);
}

export interface CreatedUser {
  id: string;
  name: string;
  email: string;
  password: string;
}

// `adminRequest` must be signed in as an admin (POST /api/users is admin-only).
export async function createUser(
  adminRequest: APIRequestContext,
  name: string,
  role: 'user' | 'admin' = 'user',
): Promise<CreatedUser> {
  const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.com`;
  const password = 'Test@12345';
  const response = await adminRequest.post('/api/users', {
    data: { name, email, password, role, phone: '', address: '' },
  });
  expect(response.status()).toBe(201);
  const { user } = await response.json();
  return { id: user.id, name, email, password };
}

// Also removes their tickets and files (server-side cascade).
export async function deleteUsers(adminRequest: APIRequestContext, ids: string[]) {
  const statuses = await Promise.all(ids.map(async (id) => (await adminRequest.delete(`/api/users/${id}`)).status()));
  for (const status of statuses) expect([204, 404]).toContain(status);
}

// A separate cookie jar signed in as `user`, for acting as a second account
// alongside the page's own session. Dispose it when done.
export async function signedInRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string | undefined,
  user: Pick<CreatedUser, 'email' | 'password'>,
): Promise<APIRequestContext> {
  const request = await playwright.request.newContext({ baseURL });
  const response = await request.post('/api/auth/login', { data: { email: user.email, password: user.password } });
  expect(response.ok()).toBeTruthy();
  return request;
}

// A repository-only file (not tied to a ticket) of exactly `sizeBytes`.
export async function uploadFile(
  request: APIRequestContext,
  topic: string,
  fileName: string,
  sizeBytes = 16,
): Promise<string> {
  const response = await request.post('/api/attachments', {
    multipart: {
      topic,
      files: { name: fileName, mimeType: 'text/plain', buffer: Buffer.alloc(sizeBytes, 'a') },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).attachments[0].id as string;
}

export async function deleteFiles(request: APIRequestContext, ids: string[]) {
  const statuses = await Promise.all(ids.map(async (id) => (await request.delete(`/api/attachments/${id}`)).status()));
  for (const status of statuses) expect([204, 404]).toContain(status);
}

// Reach Tabs keeps every panel mounted, so controls can exist more than once
// in the DOM; only the visible one is the one on screen.
export function visible(page: Page, testId: string) {
  return page.getByTestId(testId).filter({ visible: true });
}

export function visibleRows(page: Page, rowTestIdPrefix: 'ticket-row-' | 'user-row-' | 'file-repo-row-') {
  return page.locator(`tbody tr[data-testid^="${rowTestIdPrefix}"]`).filter({ visible: true });
}
