import { readDb, writeDb } from '../db';
import { generateTicketId, generateMessageId } from '../../utils/id';
import type { Role, Ticket } from '../../models/types';

export interface CreateTicketInput {
  title: string;
  description: string;
  submittedBy: string;
  submittedByName: string;
}

export const ticketRepository = {
  async list(): Promise<Ticket[]> {
    const db = await readDb();
    return [...db.tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listByUser(userId: string): Promise<Ticket[]> {
    const all = await this.list();
    return all.filter((t) => t.submittedBy === userId);
  },

  async findById(id: string): Promise<Ticket | undefined> {
    const db = await readDb();
    return db.tickets.find((t) => t.id === id);
  },

  async create(input: CreateTicketInput): Promise<Ticket> {
    const db = await readDb();
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: generateTicketId(db.tickets.length),
      title: input.title,
      description: input.description,
      submittedBy: input.submittedBy,
      submittedByName: input.submittedByName,
      status: 'open',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    db.tickets.push(ticket);
    await writeDb(db);
    return ticket;
  },

  async addMessage(
    id: string,
    body: string,
    authorId: string,
    authorName: string,
    authorRole: Role,
  ): Promise<Ticket | undefined> {
    const db = await readDb();
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) return undefined;

    const now = new Date().toISOString();
    ticket.messages.push({
      id: generateMessageId(),
      body,
      authorId,
      authorName,
      authorRole,
      createdAt: now,
    });
    // An admin message means the ball's back in the submitter's court;
    // a message from the submitter means it needs admin attention again.
    ticket.status = authorRole === 'admin' ? 'answered' : 'open';
    ticket.updatedAt = now;

    await writeDb(db);
    return ticket;
  },

  async close(id: string): Promise<Ticket | undefined> {
    const db = await readDb();
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) return undefined;

    ticket.status = 'closed';
    ticket.updatedAt = new Date().toISOString();

    await writeDb(db);
    return ticket;
  },

  async reopen(id: string): Promise<Ticket | undefined> {
    const db = await readDb();
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) return undefined;

    ticket.status = 'open';
    ticket.updatedAt = new Date().toISOString();

    await writeDb(db);
    return ticket;
  },
};
