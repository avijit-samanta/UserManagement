import { getSupabaseClient } from '../supabaseClient';
import type { Role, Ticket, TicketMessage } from '../../models/types';

export interface CreateTicketInput {
  title: string;
  description: string;
  submittedBy: string;
  submittedByName: string;
}

interface TicketRow {
  id: string;
  title: string;
  description: string;
  submitted_by: string;
  submitted_by_name: string;
  status: Ticket['status'];
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  ticket_id: string;
  body: string;
  author_id: string;
  author_name: string;
  author_role: Role;
  created_at: string;
}

function messageFromRow(row: MessageRow): TicketMessage {
  return {
    id: row.id,
    body: row.body,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    createdAt: row.created_at,
  };
}

// messages is fetched separately (one query per ticket list, not a join)
// so list()/listByUser() can order tickets and their messages
// independently without PostgREST's embedded-resource ordering syntax.
function ticketFromRow(row: TicketRow, messages: TicketMessage[]): Ticket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    submittedBy: row.submitted_by,
    submittedByName: row.submitted_by_name,
    status: row.status,
    messages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function attachMessages(rows: TicketRow[]): Promise<Ticket[]> {
  if (rows.length === 0) return [];

  const { data, error } = await getSupabaseClient()
    .from('ticket_messages')
    .select('*')
    .in('ticket_id', rows.map((r) => r.id))
    .order('created_at', { ascending: true });
  if (error) throw error;

  const messagesByTicket = new Map<string, TicketMessage[]>();
  for (const row of data as MessageRow[]) {
    const list = messagesByTicket.get(row.ticket_id) ?? [];
    list.push(messageFromRow(row));
    messagesByTicket.set(row.ticket_id, list);
  }

  return rows.map((row) => ticketFromRow(row, messagesByTicket.get(row.id) ?? []));
}

export const ticketRepository = {
  async list(): Promise<Ticket[]> {
    const { data, error } = await getSupabaseClient()
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return attachMessages(data as TicketRow[]);
  },

  async listByUser(userId: string): Promise<Ticket[]> {
    const { data, error } = await getSupabaseClient()
      .from('tickets')
      .select('*')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return attachMessages(data as TicketRow[]);
  },

  async findById(id: string): Promise<Ticket | undefined> {
    const { data, error } = await getSupabaseClient().from('tickets').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const [ticket] = await attachMessages([data as TicketRow]);
    return ticket;
  },

  async create(input: CreateTicketInput): Promise<Ticket> {
    // No `id` passed — the trg_set_ticket_id trigger
    // (supabase/migrations/0002_ticket_id_and_message_uuid.sql) assigns
    // the TCK-000001-style id from a bigserial sequence, so concurrent
    // creates can't collide the way an in-memory counter could.
    const { data, error } = await getSupabaseClient()
      .from('tickets')
      .insert({
        title: input.title,
        description: input.description,
        submitted_by: input.submittedBy,
        submitted_by_name: input.submittedByName,
        status: 'open',
      })
      .select('*')
      .single();
    if (error) throw error;
    return ticketFromRow(data as TicketRow, []);
  },

  async addMessage(
    id: string,
    body: string,
    authorId: string,
    authorName: string,
    authorRole: Role,
  ): Promise<Ticket | undefined> {
    const supabase = getSupabaseClient();

    const { data: messageRow, error: messageError } = await supabase
      .from('ticket_messages')
      .insert({ ticket_id: id, body, author_id: authorId, author_name: authorName, author_role: authorRole })
      .select('*')
      .maybeSingle();
    if (messageError) {
      // Foreign key violation (ticket id doesn't exist) -> treat like the
      // old JSON repository's "ticket not found" case instead of throwing.
      if (messageError.code === '23503') return undefined;
      throw messageError;
    }
    if (!messageRow) return undefined;

    // An admin message means the ball's back in the submitter's court; a
    // message from the submitter means it needs admin attention again —
    // same rule as before, just written as an UPDATE instead of a JS
    // array mutation.
    const { data: ticketRow, error: ticketError } = await supabase
      .from('tickets')
      .update({ status: authorRole === 'admin' ? 'answered' : 'open', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticketRow) return undefined;

    const [ticket] = await attachMessages([ticketRow as TicketRow]);
    return ticket;
  },

  async close(id: string): Promise<Ticket | undefined> {
    const { data, error } = await getSupabaseClient()
      .from('tickets')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const [ticket] = await attachMessages([data as TicketRow]);
    return ticket;
  },

  async reopen(id: string): Promise<Ticket | undefined> {
    const { data, error } = await getSupabaseClient()
      .from('tickets')
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const [ticket] = await attachMessages([data as TicketRow]);
    return ticket;
  },
};
