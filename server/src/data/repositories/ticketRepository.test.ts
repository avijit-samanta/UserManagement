import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// See userRepository.test.ts for why this is a dynamic import after setting
// DB_PATH, rather than a static top-level import.
const TEST_DB_PATH = path.join(os.tmpdir(), `helpdesk-test-tickets-${process.pid}-${Date.now()}.json`);
process.env.DB_PATH = TEST_DB_PATH;

let ticketRepository: typeof import('./ticketRepository').ticketRepository;
let writeDb: typeof import('../db').writeDb;

beforeAll(async () => {
  ({ ticketRepository } = await import('./ticketRepository'));
  ({ writeDb } = await import('../db'));
});

beforeEach(async () => {
  await writeDb({ users: [], tickets: [] });
});

afterAll(async () => {
  await fs.rm(TEST_DB_PATH, { force: true });
});

async function createTicket() {
  return ticketRepository.create({
    title: 'Test ticket',
    description: 'Something is broken',
    submittedBy: 'user-1',
    submittedByName: 'Jamie User',
  });
}

describe('ticketRepository.create', () => {
  it('starts a new ticket as open with no messages', async () => {
    const ticket = await createTicket();
    expect(ticket.status).toBe('open');
    expect(ticket.messages).toEqual([]);
  });
});

describe('ticketRepository.addMessage — the two-way conversation state machine', () => {
  it('an admin message sets status to "answered"', async () => {
    const ticket = await createTicket();
    const updated = await ticketRepository.addMessage(ticket.id, 'We are looking into it', 'admin-1', 'Alex Admin', 'admin');
    expect(updated?.status).toBe('answered');
    expect(updated?.messages).toHaveLength(1);
    expect(updated?.messages[0]).toMatchObject({ authorRole: 'admin', body: 'We are looking into it' });
  });

  it('a submitter message sets status to "open", even from "answered"', async () => {
    const ticket = await createTicket();
    await ticketRepository.addMessage(ticket.id, 'We are looking into it', 'admin-1', 'Alex Admin', 'admin');

    const updated = await ticketRepository.addMessage(ticket.id, 'Still broken', 'user-1', 'Jamie User', 'user');

    expect(updated?.status).toBe('open');
    expect(updated?.messages).toHaveLength(2);
  });

  it('messages accumulate in order rather than replacing each other', async () => {
    const ticket = await createTicket();
    await ticketRepository.addMessage(ticket.id, 'First', 'admin-1', 'Alex Admin', 'admin');
    await ticketRepository.addMessage(ticket.id, 'Second', 'user-1', 'Jamie User', 'user');
    const updated = await ticketRepository.addMessage(ticket.id, 'Third', 'admin-1', 'Alex Admin', 'admin');

    expect(updated?.messages.map((m) => m.body)).toEqual(['First', 'Second', 'Third']);
  });

  it('returns undefined for a ticket id that does not exist', async () => {
    const updated = await ticketRepository.addMessage('TCK-NOPE', 'x', 'admin-1', 'Alex Admin', 'admin');
    expect(updated).toBeUndefined();
  });
});

describe('ticketRepository.close / reopen', () => {
  it('close() sets status to "closed"', async () => {
    const ticket = await createTicket();
    const closed = await ticketRepository.close(ticket.id);
    expect(closed?.status).toBe('closed');
  });

  it('reopen() sets status back to "open"', async () => {
    const ticket = await createTicket();
    await ticketRepository.close(ticket.id);
    const reopened = await ticketRepository.reopen(ticket.id);
    expect(reopened?.status).toBe('open');
  });
});

describe('ticketRepository.list / listByUser', () => {
  it('list() returns tickets newest-first', async () => {
    const first = await createTicket();
    await new Promise((resolve) => setTimeout(resolve, 5)); // ensure a distinct createdAt
    const second = await createTicket();

    const all = await ticketRepository.list();
    expect(all[0].id).toBe(second.id);
    expect(all[1].id).toBe(first.id);
  });

  it('listByUser() only returns that user\'s tickets', async () => {
    await ticketRepository.create({
      title: 'Someone else\'s ticket',
      description: '...',
      submittedBy: 'user-2',
      submittedByName: 'Other User',
    });
    await createTicket(); // submittedBy: 'user-1'

    const mine = await ticketRepository.listByUser('user-1');
    expect(mine).toHaveLength(1);
    expect(mine[0].submittedBy).toBe('user-1');
  });
});
