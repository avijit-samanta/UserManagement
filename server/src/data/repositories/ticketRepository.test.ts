import { beforeEach, describe, expect, it } from 'vitest';
import { ticketRepository } from './ticketRepository';
import { userRepository } from './userRepository';
import { truncateTestTables } from './testHelpers';

beforeEach(async () => {
  await truncateTestTables();
});

// Unlike the old JSON-file version, tickets/messages now have real foreign
// keys to users(id) — a made-up string like 'user-1' would fail with a
// Postgres FK violation, so tests create real user rows first.
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

async function createTicket(submittedBy: string, submittedByName: string) {
  return ticketRepository.create({
    title: 'Test ticket',
    description: 'Something is broken',
    submittedBy,
    submittedByName,
  });
}

describe('ticketRepository.create', () => {
  it('starts a new ticket as open with no messages', async () => {
    const user = await createUser('user1@example.com');
    const ticket = await createTicket(user.id, user.name);
    expect(ticket.status).toBe('open');
    expect(ticket.messages).toEqual([]);
    expect(ticket.id).toMatch(/^TCK-\d{6}$/);
  });
});

describe('ticketRepository.addMessage — the two-way conversation state machine', () => {
  it('an admin message sets status to "answered"', async () => {
    const user = await createUser('user2@example.com');
    const admin = await createUser('admin1@example.com', 'admin');
    const ticket = await createTicket(user.id, user.name);

    const updated = await ticketRepository.addMessage(ticket.id, 'We are looking into it', admin.id, admin.name, 'admin');
    expect(updated?.status).toBe('answered');
    expect(updated?.messages).toHaveLength(1);
    expect(updated?.messages[0]).toMatchObject({ authorRole: 'admin', body: 'We are looking into it' });
  });

  it('a submitter message sets status to "open", even from "answered"', async () => {
    const user = await createUser('user3@example.com');
    const admin = await createUser('admin2@example.com', 'admin');
    const ticket = await createTicket(user.id, user.name);
    await ticketRepository.addMessage(ticket.id, 'We are looking into it', admin.id, admin.name, 'admin');

    const updated = await ticketRepository.addMessage(ticket.id, 'Still broken', user.id, user.name, 'user');

    expect(updated?.status).toBe('open');
    expect(updated?.messages).toHaveLength(2);
  });

  it('messages accumulate in order rather than replacing each other', async () => {
    const user = await createUser('user4@example.com');
    const admin = await createUser('admin3@example.com', 'admin');
    const ticket = await createTicket(user.id, user.name);
    await ticketRepository.addMessage(ticket.id, 'First', admin.id, admin.name, 'admin');
    await ticketRepository.addMessage(ticket.id, 'Second', user.id, user.name, 'user');
    const updated = await ticketRepository.addMessage(ticket.id, 'Third', admin.id, admin.name, 'admin');

    expect(updated?.messages.map((m) => m.body)).toEqual(['First', 'Second', 'Third']);
  });

  it('returns undefined for a ticket id that does not exist', async () => {
    const admin = await createUser('admin4@example.com', 'admin');
    const updated = await ticketRepository.addMessage('TCK-NOPE', 'x', admin.id, admin.name, 'admin');
    expect(updated).toBeUndefined();
  });
});

describe('ticketRepository.close / reopen', () => {
  it('close() sets status to "closed"', async () => {
    const user = await createUser('user5@example.com');
    const ticket = await createTicket(user.id, user.name);
    const closed = await ticketRepository.close(ticket.id);
    expect(closed?.status).toBe('closed');
  });

  it('reopen() sets status back to "open"', async () => {
    const user = await createUser('user6@example.com');
    const ticket = await createTicket(user.id, user.name);
    await ticketRepository.close(ticket.id);
    const reopened = await ticketRepository.reopen(ticket.id);
    expect(reopened?.status).toBe('open');
  });
});

describe('ticketRepository.list / listByUser', () => {
  it('list() returns tickets newest-first', async () => {
    const user = await createUser('user7@example.com');
    const first = await createTicket(user.id, user.name);
    await new Promise((resolve) => setTimeout(resolve, 5)); // ensure a distinct createdAt
    const second = await createTicket(user.id, user.name);

    const all = await ticketRepository.list();
    expect(all[0].id).toBe(second.id);
    expect(all[1].id).toBe(first.id);
  });

  it('listByUser() only returns that user\'s tickets', async () => {
    const user1 = await createUser('user8@example.com');
    const user2 = await createUser('user9@example.com');
    await ticketRepository.create({
      title: "Someone else's ticket",
      description: '...',
      submittedBy: user2.id,
      submittedByName: user2.name,
    });
    const mine = await createTicket(user1.id, user1.name);

    const result = await ticketRepository.listByUser(user1.id);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(mine.id);
    expect(result[0].submittedBy).toBe(user1.id);
  });
});

describe('ticketRepository.delete', () => {
  it('removes the ticket and its messages, and reports whether anything was deleted', async () => {
    const user = await createUser('user10@example.com');
    const ticket = await createTicket(user.id, user.name);
    await ticketRepository.addMessage(ticket.id, 'Follow-up', user.id, user.name, 'user');

    expect(await ticketRepository.delete(ticket.id)).toBe(true);
    expect(await ticketRepository.findById(ticket.id)).toBeUndefined();
    expect(await ticketRepository.delete(ticket.id)).toBe(false);
  });
});

describe('ticketRepository.deleteByUser / hasMessagesOnOthersTickets', () => {
  it("deleteByUser() removes only that user's tickets", async () => {
    const user1 = await createUser('user11@example.com');
    const user2 = await createUser('user12@example.com');
    await createTicket(user1.id, user1.name);
    await createTicket(user1.id, user1.name);
    const kept = await createTicket(user2.id, user2.name);

    await ticketRepository.deleteByUser(user1.id);

    expect(await ticketRepository.listByUser(user1.id)).toEqual([]);
    expect((await ticketRepository.list()).map((t) => t.id)).toEqual([kept.id]);
  });

  it("is true for an admin who replied on someone's ticket, false for a user replying on their own", async () => {
    const user = await createUser('user13@example.com');
    const admin = await createUser('admin3@example.com', 'admin');
    const ticket = await createTicket(user.id, user.name);
    await ticketRepository.addMessage(ticket.id, 'Own follow-up', user.id, user.name, 'user');

    expect(await ticketRepository.hasMessagesOnOthersTickets(user.id)).toBe(false);
    expect(await ticketRepository.hasMessagesOnOthersTickets(admin.id)).toBe(false);

    await ticketRepository.addMessage(ticket.id, 'Admin reply', admin.id, admin.name, 'admin');
    expect(await ticketRepository.hasMessagesOnOthersTickets(admin.id)).toBe(true);
  });
});
