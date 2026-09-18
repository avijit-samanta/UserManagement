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

export type TicketStatus = 'open' | 'answered';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  submittedBy: string;
  submittedByName: string;
  status: TicketStatus;
  adminResponse: string | null;
  respondedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
