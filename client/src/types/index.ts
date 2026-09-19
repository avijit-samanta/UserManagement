export type Role = 'admin' | 'user';

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export type TicketStatus = 'open' | 'answered' | 'closed';

export interface TicketMessage {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  submittedBy: string;
  submittedByName: string;
  status: TicketStatus;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}
