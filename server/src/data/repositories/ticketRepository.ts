import { readDb, writeDb } from '../db';
import { generateTicketId } from '../../utils/id';
import type { Ticket } from '../../models/types';

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
      adminResponse: null,
      respondedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    db.tickets.push(ticket);
    await writeDb(db);
    return ticket;
  },

  async respond(id: string, response: string, respondedBy: string): Promise<Ticket | undefined> {
    const db = await readDb();
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) return undefined;

    ticket.adminResponse = response;
    ticket.respondedBy = respondedBy;
    ticket.status = 'answered';
    ticket.updatedAt = new Date().toISOString();

    await writeDb(db);
    return ticket;
  },
};
