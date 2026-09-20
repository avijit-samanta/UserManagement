import { beforeEach, describe, expect, it } from 'vitest';
import { attachmentRepository } from './attachmentRepository';
import { ticketRepository } from './ticketRepository';
import { userRepository } from './userRepository';
import { truncateTestTables } from './testHelpers';
import { generateUuid } from '../../utils/id';

beforeEach(async () => {
  await truncateTestTables();
});

// Unlike the old JSON-file version, attachments/tickets now have real
// foreign keys to users(id) — a made-up string like 'user-1' would fail
// with a Postgres FK violation, so tests create a real user row first.
function createUser(email: string, role: 'admin' | 'user' = 'user') {
  return userRepository.create({
    email,
    passwordHash: 'hashed',
    role,
    name: role === 'admin' ? 'Alex Admin' : 'Jamie User',
    phone: '',
    address: '',
  });
}

function uploadInput(overrides: Partial<Parameters<typeof attachmentRepository.create>[0]> = {}) {
  return {
    id: generateUuid(),
    fileName: 'screenshot.png',
    storagePath: 'standalone/abc123-screenshot.png',
    mimeType: 'image/png',
    size: 2048,
    topic: 'General',
    ticketId: null,
    messageId: null,
    uploadedBy: 'placeholder',
    uploadedByName: 'Jamie User',
    uploadedByRole: 'user' as const,
    ...overrides,
  };
}

describe('attachmentRepository.create / findById', () => {
  it('stores a file record and can look it up by id', async () => {
    const user = await createUser('uploader1@example.com');
    const created = await attachmentRepository.create(uploadInput({ uploadedBy: user.id }));
    const found = await attachmentRepository.findById(created.id);
    expect(found).toMatchObject({ fileName: 'screenshot.png', topic: 'General', uploadedBy: user.id });
  });
});

describe('attachmentRepository.listAll', () => {
  it('returns files newest-first', async () => {
    const user = await createUser('uploader2@example.com');
    const first = await attachmentRepository.create(uploadInput({ uploadedBy: user.id }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await attachmentRepository.create(uploadInput({ id: generateUuid(), fileName: 'second.png', uploadedBy: user.id }));

    const all = await attachmentRepository.listAll();
    expect(all[0].id).toBe(second.id);
    expect(all[1].id).toBe(first.id);
  });
});

describe('attachmentRepository.listForTicket', () => {
  it('only returns files attached to that ticket', async () => {
    const user = await createUser('uploader3@example.com');
    const ticket = await ticketRepository.create({
      title: 'Broken login',
      description: '...',
      submittedBy: user.id,
      submittedByName: user.name,
    });
    await attachmentRepository.create(uploadInput({ ticketId: ticket.id, uploadedBy: user.id }));
    await attachmentRepository.create(uploadInput({ id: generateUuid(), fileName: 'unrelated.pdf', ticketId: null, uploadedBy: user.id }));

    const forTicket = await attachmentRepository.listForTicket(ticket.id);
    expect(forTicket).toHaveLength(1);
    expect(forTicket[0].ticketId).toBe(ticket.id);
  });
});

describe('attachmentRepository.listVisibleToUser', () => {
  it("includes the user's own repository-only uploads (no ticket)", async () => {
    const user = await createUser('uploader4@example.com');
    await attachmentRepository.create(uploadInput({ uploadedBy: user.id, ticketId: null }));

    const visible = await attachmentRepository.listVisibleToUser(user.id);
    expect(visible).toHaveLength(1);
  });

  it("includes an admin's file attached to the user's own ticket", async () => {
    const user = await createUser('owner1@example.com');
    const admin = await createUser('admin1@example.com', 'admin');
    const ticket = await ticketRepository.create({
      title: 'Broken login',
      description: '...',
      submittedBy: user.id,
      submittedByName: user.name,
    });
    await attachmentRepository.create(
      uploadInput({ ticketId: ticket.id, uploadedBy: admin.id, uploadedByName: admin.name, uploadedByRole: 'admin' }),
    );

    const visible = await attachmentRepository.listVisibleToUser(user.id);
    expect(visible).toHaveLength(1);
    expect(visible[0].uploadedByRole).toBe('admin');
  });

  it("excludes another user's repository-only upload and another user's ticket attachment", async () => {
    const user = await createUser('owner2@example.com');
    const otherUser = await createUser('other1@example.com');
    const admin = await createUser('admin2@example.com', 'admin');
    const otherTicket = await ticketRepository.create({
      title: "Someone else's ticket",
      description: '...',
      submittedBy: otherUser.id,
      submittedByName: otherUser.name,
    });
    await attachmentRepository.create(uploadInput({ uploadedBy: otherUser.id, ticketId: null }));
    await attachmentRepository.create(
      uploadInput({ id: generateUuid(), uploadedBy: admin.id, uploadedByRole: 'admin', ticketId: otherTicket.id }),
    );

    const visible = await attachmentRepository.listVisibleToUser(user.id);
    expect(visible).toHaveLength(0);
  });
});

describe('attachmentRepository.delete', () => {
  it('removes the record so it no longer appears in any listing', async () => {
    const user = await createUser('uploader5@example.com');
    const created = await attachmentRepository.create(uploadInput({ uploadedBy: user.id }));
    const removed = await attachmentRepository.delete(created.id);

    expect(removed?.id).toBe(created.id);
    expect(await attachmentRepository.findById(created.id)).toBeUndefined();
    expect(await attachmentRepository.listAll()).toHaveLength(0);
  });

  it('returns undefined for an id that does not exist', async () => {
    expect(await attachmentRepository.delete('00000000-0000-0000-0000-000000000000')).toBeUndefined();
  });

  it('returns undefined (not a Postgres error) for a malformed id', async () => {
    expect(await attachmentRepository.delete('nope')).toBeUndefined();
  });
});
